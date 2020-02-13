![Observer bot cover](https://i.imgur.com/sbY01jC.jpg)
# Observer.bot - A Discord.js/Node bot
A lightweight bot that monitors user activity and writes it to a database.
Implements gathered data analyzing functionality that allows Discord server administrators/moderators/owners to increase the level of server moderation and user experience.
## Prerequisites
1. **Discord.js** - 
    `$ npm install discord.js`
2. **Mysql** - 
    `$ npm install mysql`
3. **Discord bot token** - 
	[Register an application](https://discordapp.com/developers/applications/), a bot and retrieve the token.
	Insert the token in the appropriate field in `env.json`
4. **Database** - 
	Import the database to your database server.
	The file required is `bot.sql` and it contains only the structure of the database.
	
	Edit the `env.json` file with the proper database information.
	
	Known issue - [ER_NOT_SUPPORTED_AUTH_MODE](https://github.com/mysqljs/mysql/issues/2046)

## Usage

**Windows**
<kbd> Windows </kbd> + <kbd> R </kbd>, type in `cmd` and click <kbd> Enter </kbd>

**Linux**
<kbd> CTRL </kbd> + <kbd>ALT </kbd> + <kbd> T </kbd>

**MacOS**
<kbd>⌘ Command</kbd> + <kbd> Space </kbd>, type in `terminal` and click <kbd> Enter </kbd>

Navigate through terminal/cmd to your bot folder, or open the terminal in the folder.

### Starting the bot
With the terminal open, type in: 
```node manager.js```

It should start a bot manager that handles shards and start as many bots as needed in order to handle the guilds.
## Basic functions
The initial bot prefix is <kbd>,</kbd> which is used to call any function.
Only server owners can change this value.

To see more functions of the bot send `,doc` to any channel.
## License

[MIT License](https://github.com/dsheedes/observer.bot/blob/master/LICENSE) © 2020, Gvozden Despotovski

