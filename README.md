# Discord Chat Analytics Bot

A powerful Discord bot designed to provide deep insights into your server's activity. It analyzes chat history to identify top contributors, popular messages, and engagement trends.

## Features

*   **Channel Analysis (`!analyze`)**:
    *   Scans the **entire history** of the current channel.
    *   Highlights the **Most Reacted** messages.
    *   Highlights the **Most Replied To** messages.
*   **User Specific Analysis (`!analyze @user`)**:
    *   Filters the channel analysis for a specific user.
    *   Shows total **Messages Sent**, **Reactions Received**, and **Replies Received** for that user in the channel.
    *   Displays their personal top messages.
*   **Server-Wide Statistics (`!serverstats`)**:
    *   **Global Scan:** Iterates through *every* text channel in the server.
    *   **Leaderboards:** Shows the "Top Talkers" (most messages) and "Most Liked Users" (most reactions) across the server.
    *   **Global Highlights:** Finds the absolute most reacted and replied-to messages in the entire server.

## Installation

### Prerequisites
*   [Node.js](https://nodejs.org/) (v16.9.0 or higher)
*   A Discord Bot Token

### Setup Steps

1.  **Clone/Download the project** to your local machine.
2.  **Install Dependencies:**
    Open your terminal/command prompt in the project folder and run:
    ```bash
    npm install
    ```
3.  **Configure Environment:**
    *   Open the `.env` file.
    *   Paste your bot token:
        ```env
        DISCORD_TOKEN=your_actual_token_here
        ```
    *   *If you don't have a token, create a new application in the [Discord Developer Portal](https://discord.com/developers/applications), go to the "Bot" tab, and click "Reset Token".*

4.  **Enable Privileged Intents:**
    *   Go to the [Discord Developer Portal](https://discord.com/developers/applications).
    *   Select your application -> **Bot** tab.
    *   Scroll down to "Privileged Gateway Intents".
    *   **Enable "Message Content Intent"** (Required to read messages).
    *   **Enable "Server Members Intent"** (Good practice, though mostly used for member caching).
    *   Save Changes.

5.  **Start the Bot:**
    ```bash
    node index.js
    ```

## Usage Commands

Type these commands in any text channel the bot has access to:

| Command | Description |
| :--- | :--- |
| `!analyze` | Fetches full history of the *current channel* and shows top messages. |
| `!stats` | Alias for `!analyze`. |
| `!analyze @user` | Shows stats and top messages for the *mentioned user* in the current channel. |
| `!serverstats` | **(Admin Recommended)** Scans ALL channels to generate a server-wide report. *Note: This can take a while.* |

## Troubleshooting

*   **"Missing Access" Error:** Ensure the bot has the `Read Messages`, `Read Message History`, and `View Channels` permissions in the channels you are trying to scan.
*   **Bot not replying:** Make sure `Message Content Intent` is enabled in the Developer Portal.
*   **Slow Performance:** Scanning thousands of messages takes time due to Discord's API rate limits. The bot will provide status updates as it works.