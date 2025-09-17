
// policy.js
const path = require('path');

class Policy {
  constructor(config) {
    this.config = config;
    this.blockedPaths = config.policies && config.policies.noAutoMergePaths || [];
  }

  // filesTouched: array of file path strings
  isBlocked(filesTouched) {
    if (!filesTouched || filesTouched.length === 0) return false;
    for (const f of filesTouched) {
      for (const blocked of this.blockedPaths) {
        // simple match, can be enhanced with globs
        if (f.includes(blocked) || f === blocked) return true;
      }
    }
    return false;
  }
}

module.exports = Policy;
