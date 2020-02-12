const Discord = require('discord.js');
const env = require("./env.json");
let Ad = require("./classes/ad.js") //Advertising module. Returns a random ad.

const Manager = new Discord.ShardingManager("bot.js", {token:env.token});
Manager.spawn();
console.log("Spawning shards...");

Manager.on("message", (shard, message) => {
    //Shards are saying something...
});


console.log(Ad.generate());
