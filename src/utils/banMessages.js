const insultPrefixes = [
    "🤡 Another clown bites the dust!",
    "👋 See ya never,",
    "🗑️ Taking out the trash:",
    "🚮 Time to clean up:",
    "💀 Rest in pieces,",
    "🎪 The circus is missing a clown:",
    "🎭 Exit stage left:",
    "🚫 Access DENIED:",
    "⛔ Get rekt,",
    "🎮 Game Over for",
    "🔥 Another roasted cheater:",
"🔨 And the hammer drops on:",
"🙅‍♂️ No mercy for:",
"🪦 Buried six feet under:",
"🚷 Banned and barred:",
"🌪️ Swept away by the ban storm:",
"🌌 Banished to the shadow realm:",
"🎯 Marked and removed:",
"🎆 Fireworks for this farewell:",
"🌊 Adrift in the sea of bans:",
"🏹 Shot down before takeoff:",
"🌀 Flushed down the ban vortex:",
"🌪️ Twister of justice claims:",
"👋 Waving bye-bye to:",
"🌩️ Lightning strike on:",
"🔇 Muted for eternity:",
"🏴 Black flag raised against:",
"💥 Boom! Ban hammer hits:",
"🚽 Flushing out the nonsense from:",
"⚰️ Putting the final nail in the coffin for:",
"💨 Gone with the wind:",
"🤸 Gymnastics won't save:",
"🎇 Firecracker farewell for:",
"🔒 Locked out, key thrown away for:",
"🌈 Taste the rainbow of bans,",
"🍂 Falling like autumn leaves:",
"🎱 Eight-ball says no chance for:",
"💤 Putting to eternal rest:",
"🗡️ Swift strike on the foolish:",
"💣 Explosive departure for:",
"🧨 A big bang goodbye for:",
"🌋 Eruption of justice melts:",
"👻 Boo! Ghosted away is:"
];

const banMessages = [
    "Caught using mom's credit card for hacks!",
"Couldn't hack their way out of a paper bag!",
"Speedrunning the ban any%!",
"Skill issue detected!",
"Forgot to toggle their gaming chair!",
"Didn't drink enough G-Fuel!",
"Their dog ate their gaming skills!",
"Tried to outpizza the anticheat!",
"Forgot this wasn't creative mode!",
"Should've downloaded more RAM!",
"Got smacked by the ban hammer—ouch!",
"They tried to run, but the logs never lie!",
"Paper-thin excuses, meet the real world!",
"Ran out of cheat codes, ran into a ban!",
"Out of lives, out of luck!",
"Got caught in 4K, no free respawns!",
"Accessing server was their final boss battle!",
"Cheat engine just blew a fuse!",
"Ban was super effective!",
"Should've consulted their moral compass!",
"Outsmarted themselves into oblivion!",
"Went for cheat day, got a permanent diet!",
"Knocked out by the truth bomb!",
"Self-destruct sequence initiated!",
"In denial? Ban says otherwise!",
"Out of second chances, welcome to the void!",
"Ran a shady script, got a sunny ban!",
"Lift-off to the land of no returns!",
"They raised suspicion, we raised the banhammer!",
"Achievement unlocked: BANNED!",
"Even the firewall cringed at their attempt!",
"Would you like a side of ban with that fail?",
"Hostile takeover? More like self-takeout!",
"Pulled the pin on their own ban grenade!",
"Attempted infiltration: mission aborted!"
];

const generateBanAnnouncement = (username, reason) => {
    const prefix = insultPrefixes[Math.floor(Math.random() * insultPrefixes.length)];
    const message = banMessages[Math.floor(Math.random() * banMessages.length)];
    
    return {
        embeds: [{
            title: `${prefix} ${username}`,
            description: `${message}\n\n📜 **Ban Reason:** ${reason}`,
            color: 0xFF0000,
            timestamp: new Date().toISOString(),
            footer: {
                text: "Another one bites the dust! 🎵"
            }
        }]
    };
};

module.exports = {
    generateBanAnnouncement
};
