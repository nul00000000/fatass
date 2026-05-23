import express from "express";
import fs from "fs";
import path from "path";

type Config = {
    dataDir: string;
};

let config: Config = {
    dataDir: process.env.HOME + "/.local/fatass"
};

//using synchronous io because it runs once at the beginning and thats it

if(fs.existsSync("$HOME/.config/fatass-api/config.json")) {
    const data = fs.readFileSync(process.env.HOME + "/.config/fatass-api/config.json", "utf8");
    config = JSON.parse(data);
    //check config dir?
} else {
    fs.mkdirSync(process.env.HOME + "/.config/fatass", {recursive: true});
    fs.writeFileSync(process.env.HOME + "/.config/fatass/config.json", JSON.stringify(config, null, 2));
}

//ensure data directory exists and is valid
if(!path.isAbsolute(config.dataDir)) {
    console.error("Data Dir \"" + config.dataDir + "\" is not an absolute path!");
    process.exit(78);
}
fs.mkdirSync(config.dataDir, {recursive: true});