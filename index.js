require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder, Collection, ChannelType } = require('discord.js');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMessageReactions
    ]
});

const PREFIX = '!';

client.once('ready', () => {
    console.log(`Logged in as ${client.user.tag}!`);
});

client.on('messageCreate', async message => {
    if (message.author.bot) return;
    if (!message.content.startsWith(PREFIX)) return;

    const args = message.content.slice(PREFIX.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    if (command === 'analyze' || command === 'stats') {
        try {
            // Notify user that fetching is in progress
            const statusMsg = await message.reply('🔍 Starting full channel history fetch... This may take a while depending on the message count.');

            // Fetch all messages
            let allMessages = new Collection();
            let lastId = null;
            
            while (true) {
                const options = { limit: 100 };
                if (lastId) {
                    options.before = lastId;
                }

                const messages = await message.channel.messages.fetch(options);
                
                if (messages.size === 0) break;

                messages.forEach(msg => allMessages.set(msg.id, msg));
                lastId = messages.last().id;

                // Update status every 500 messages
                if (allMessages.size % 500 === 0) {
                    await statusMsg.edit(`🔍 Fetched ${allMessages.size} messages so far...`);
                }
            }

            const messages = allMessages; // Use the full collection for analysis
            
            // Analysis Data Structures
            const reactionStats = [];
            const replyCounts = {}; // messageId -> count

            messages.forEach(msg => {
                // 1. Count Reactions
                const totalReactions = msg.reactions.cache.reduce((acc, reaction) => acc + reaction.count, 0);
                if (totalReactions > 0) {
                    reactionStats.push({
                        msg: msg,
                        count: totalReactions,
                        topEmoji: msg.reactions.cache.first().emoji.toString() // Simple grab of first emoji
                    });
                }

                // 2. Count Replies (referencing messages in this batch)
                if (msg.reference && msg.reference.messageId) {
                    const parentId = msg.reference.messageId;
                    replyCounts[parentId] = (replyCounts[parentId] || 0) + 1;
                }
            });

            // Check for target user
            const targetUser = message.mentions.users.first();
            
            // Filter and Sort Reactions
            let filteredReactions = reactionStats;
            if (targetUser) {
                filteredReactions = filteredReactions.filter(item => item.msg.author.id === targetUser.id);
            }
            filteredReactions.sort((a, b) => b.count - a.count);
            const topReactions = filteredReactions.slice(0, 3);

            // Filter and Sort Replies
            // First, convert the replyCounts object to an array of objects
            let allReplies = Object.entries(replyCounts)
                .map(([msgId, count]) => {
                    const msg = messages.get(msgId);
                    return msg ? { msg, count } : null;
                })
                .filter(item => item !== null);
            
            if (targetUser) {
                allReplies = allReplies.filter(item => item.msg.author.id === targetUser.id);
            }

            const topReplies = allReplies
                .sort((a, b) => b.count - a.count)
                .slice(0, 3);

            // Build Embed
            const embed = new EmbedBuilder()
                .setColor(0x0099FF)
                .setTitle(targetUser ? `📊 Chat Analysis for ${targetUser.username}` : `📊 Chat Analysis (Full History)`)
                .setTimestamp()
                .setDescription(`Analyzed ${messages.size} messages in ${message.channel.toString()}`);

            // Add User Stats Summary if a user is targeted
            if (targetUser) {
                const userMsgCount = messages.filter(m => m.author.id === targetUser.id).size;
                const totalReactionsReceived = filteredReactions.reduce((acc, item) => acc + item.count, 0);
                const totalRepliesReceived = allReplies.reduce((acc, item) => acc + item.count, 0);

                embed.addFields({ 
                    name: '📈 User Statistics', 
                    value: `**Messages Sent:** ${userMsgCount}\n**Total Reactions Received:** ${totalReactionsReceived}\n**Total Replies Received:** ${totalRepliesReceived}`,
                    inline: false
                });
            }

            // Add Most Reacted
            if (topReactions.length > 0) {
                const reactionText = topReactions.map((item, i) => {
                    const content = item.msg.content.length > 50 ? item.msg.content.substring(0, 50) + '...' : item.msg.content;
                    const link = `[Jump](${item.msg.url})`;
                    return `**${i + 1}.** ${item.topEmoji} **${item.count}** - ${item.msg.author.username}: "${content}" ${link}`;
                }).join('\n');
                embed.addFields({ name: '🔥 Most Reacted', value: reactionText });
            } else {
                embed.addFields({ name: '🔥 Most Reacted', value: 'No reactions found in recent messages.' });
            }

            // Add Most Replied
            if (topReplies.length > 0) {
                const replyText = topReplies.map((item, i) => {
                    const content = item.msg.content.length > 50 ? item.msg.content.substring(0, 50) + '...' : item.msg.content;
                    const link = `[Jump](${item.msg.url})`;
                    return `**${i + 1}.** 💬 **${item.count} replies** - ${item.msg.author.username}: "${content}" ${link}`;
                }).join('\n');
                embed.addFields({ name: '🗣️ Most Replied To', value: replyText });
            } else {
                embed.addFields({ name: '🗣️ Most Replied To', value: 'No replies found in recent messages.' });
            }

            // Edit the status message with the result
            await statusMsg.edit({ content: null, embeds: [embed] });

        } catch (error) {
            console.error('Error analyzing messages:', error);
            message.reply('❌ An error occurred while analyzing messages. Please check my console for details.');
        }
    }

    if (command === 'serverstats') {
        try {
            const statusMsg = await message.reply('🚀 Starting server-wide analysis... This will take a significant amount of time.');
            
            const textChannels = message.guild.channels.cache.filter(c => c.type === ChannelType.GuildText);
            const totalChannels = textChannels.size;
            let processedChannels = 0;
            let totalMessagesScanned = 0;

            // Global Stats Containers
            const globalUserStats = new Collection(); // userId -> { sent: 0, reactions: 0, tag: '' }
            let globalTopReacted = []; // Keep top 3 { msg, count, link }
            const globalReplyCounts = new Map(); // msgId -> { count, channelId }

            for (const [channelId, channel] of textChannels) {
                // Update status
                await statusMsg.edit(`📂 Scanning channel ${processedChannels + 1}/${totalChannels}: ${channel.name} (Total scanned: ${totalMessagesScanned})...`);

                try {
                    let lastId = null;
                    while (true) {
                        const options = { limit: 100 };
                        if (lastId) options.before = lastId;

                        const messages = await channel.messages.fetch(options);
                        if (messages.size === 0) break;

                        messages.forEach(msg => {
                            totalMessagesScanned++;
                            
                            // 1. User Stats
                            const uStats = globalUserStats.get(msg.author.id) || { sent: 0, reactions: 0, tag: msg.author.tag };
                            uStats.sent++;
                            const reactions = msg.reactions.cache.reduce((acc, r) => acc + r.count, 0);
                            uStats.reactions += reactions;
                            globalUserStats.set(msg.author.id, uStats);

                            // 2. Top Reacted (Global)
                            if (reactions > 0) {
                                globalTopReacted.push({
                                    content: msg.content,
                                    author: msg.author.tag,
                                    count: reactions,
                                    url: msg.url,
                                    emoji: msg.reactions.cache.first()?.emoji?.toString() || '❤️'
                                });
                                // Keep only top 3
                                globalTopReacted.sort((a, b) => b.count - a.count);
                                if (globalTopReacted.length > 3) globalTopReacted.pop();
                            }

                            // 3. Reply Counts (Global Tracking)
                            if (msg.reference && msg.reference.messageId) {
                                const parentId = msg.reference.messageId;
                                // We store channelId too so we can fetch the parent later
                                const rData = globalReplyCounts.get(parentId) || { count: 0, channelId: msg.reference.channelId };
                                rData.count++;
                                globalReplyCounts.set(parentId, rData);
                            }
                        });

                        lastId = messages.last().id;
                    }
                } catch (err) {
                    console.error(`Failed to scan channel ${channel.name}:`, err);
                }
                processedChannels++;
            }

            await statusMsg.edit('🤔 Processing final results...');

            // Finalize Global Top Replies
            // Sort by count and take top 3 IDs
            const sortedReplyIds = [...globalReplyCounts.entries()]
                .sort((a, b) => b[1].count - a[1].count)
                .slice(0, 3);
            
            const finalTopReplies = [];
            for (const [msgId, data] of sortedReplyIds) {
                try {
                    const ch = message.guild.channels.cache.get(data.channelId);
                    if (ch) {
                        const fetchedMsg = await ch.messages.fetch(msgId);
                        finalTopReplies.push({
                            msg: fetchedMsg,
                            count: data.count
                        });
                    }
                } catch (e) {
                    // Message might be deleted or inaccessible
                    console.warn(`Could not fetch top replied message ${msgId}`);
                }
            }

            // Finalize User Leaderboards
            const sortedUsersByMsgs = [...globalUserStats.values()].sort((a, b) => b.sent - a.sent).slice(0, 3);
            const sortedUsersByReactions = [...globalUserStats.values()].sort((a, b) => b.reactions - a.reactions).slice(0, 3);

            // Build Embed
            const embed = new EmbedBuilder()
                .setColor(0xFFD700) // Gold for server stats
                .setTitle(`🏆 Server-Wide Statistics`)
                .setDescription(`Scanned **${totalMessagesScanned}** messages across **${totalChannels}** channels.`)
                .setTimestamp();

            // Top Talkers
            const talkersText = sortedUsersByMsgs.map((u, i) => `**${i+1}.** ${u.tag} — **${u.sent}** msgs`).join('\n') || 'No data';
            embed.addFields({ name: '📢 Top Talkers', value: talkersText, inline: true });

            // Most Reacted Users
            const reactedUsersText = sortedUsersByReactions.map((u, i) => `**${i+1}.** ${u.tag} — **${u.reactions}** reactions`).join('\n') || 'No data';
            embed.addFields({ name: '⭐ Most Liked Users', value: reactedUsersText, inline: true });

            // Global Most Reacted Messages
            if (globalTopReacted.length > 0) {
                const reactionText = globalTopReacted.map((item, i) => {
                    const content = item.content.length > 50 ? item.content.substring(0, 50) + '...' : item.content;
                    return `**${i + 1}.** ${item.emoji} **${item.count}** - ${item.author}: "${content}" [Jump](${item.url})`;
                }).join('\n');
                embed.addFields({ name: '🔥 Most Reacted Messages (Global)', value: reactionText, inline: false });
            }

            // Global Most Replied Messages
            if (finalTopReplies.length > 0) {
                const replyText = finalTopReplies.map((item, i) => {
                    const content = item.msg.content.length > 50 ? item.msg.content.substring(0, 50) + '...' : item.msg.content;
                    return `**${i + 1}.** 💬 **${item.count} replies** - ${item.msg.author.username}: "${content}" [Jump](${item.msg.url})`;
                }).join('\n');
                embed.addFields({ name: '🗣️ Most Replied Messages (Global)', value: replyText, inline: false });
            }

            await statusMsg.edit({ content: null, embeds: [embed] });

        } catch (error) {
            console.error('Error in serverstats:', error);
            message.reply('❌ An error occurred during server analysis.');
        }
    }
});

client.login(process.env.DISCORD_TOKEN);
