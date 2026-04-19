
const fs = require('fs');

// Mock Log and Module
global.Log = {
    info: console.log,
    warn: console.warn,
    error: console.error
};

// Mock Module.register
global.Module = {
    register: function(name, obj) {
        this.obj = obj;
    }
};

// Load the module file
const moduleContent = fs.readFileSync('MMM-SoccerStandings.js', 'utf8');
// Remove Module.register wrapper to get the object
const objMatch = moduleContent.match(/Module\.register\("MMM-SoccerStandings",\s*({[\s\S]*})\);/);
if (!objMatch) {
    console.error("Could not find Module.register in MMM-SoccerStandings.js");
    process.exit(1);
}

// Eval the object to get it
let moduleObj;
try {
    moduleObj = eval('(' + objMatch[1] + ')');
} catch (e) {
    console.error("Error evaluating module object:", e);
    process.exit(1);
}

// Test case
const config = {
    selectedLeagues: ["SPAIN_LA_LIGA"]
};

// Merge with defaults
const mergedConfig = Object.assign({}, moduleObj.defaults, config);
moduleObj.config = mergedConfig;

// Initialize enabledLeagueCodes
moduleObj.enabledLeagueCodes = [];
moduleObj.normalizeLeagueCode = function(code) {
    if (!code || typeof code !== "string") return null;
    const legacyCodeMap = {
        SPFL: "SCOTLAND_PREMIERSHIP",
        SPFLC: "SCOTLAND_CHAMPIONSHIP",
        EPL: "ENGLAND_PREMIER_LEAGUE",
        UCL: "UEFA_CHAMPIONS_LEAGUE",
        UEL: "UEFA_EUROPA_LEAGUE",
        ECL: "UEFA_EUROPA_CONFERENCE_LEAGUE",
        CHAMPIONS_LEAGUE: "UEFA_CHAMPIONS_LEAGUE",
        EUROPA_LEAGUE: "UEFA_EUROPA_LEAGUE",
        EUROPA_CONFERENCE_LEAGUE: "UEFA_EUROPA_CONFERENCE_LEAGUE"
    };
    return legacyCodeMap[code] || code;
};

// Run determineEnabledLeagues
moduleObj.determineEnabledLeagues();

console.log("Enabled League Codes:", moduleObj.enabledLeagueCodes);

if (moduleObj.enabledLeagueCodes.length === 0) {
    console.log("BUG REPRODUCED: enabledLeagueCodes is empty!");
} else if (moduleObj.enabledLeagueCodes[0] === "SPAIN_LA_LIGA") {
    console.log("SUCCESS: SPAIN_LA_LIGA is enabled.");
} else {
    console.log("UNEXPECTED RESULT:", moduleObj.enabledLeagueCodes);
}
