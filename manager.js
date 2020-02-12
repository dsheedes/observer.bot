const Discord = require('discord.js');
const env = require("./env.json");

const Manager = new Discord.ShardingManager("bot.js", {token:env.token});
Manager.spawn();
console.log("Spawning shards...");
