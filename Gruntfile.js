module.exports = (grunt) => {
  const env = grunt.option("env") || "main";

  let config;
  try {
    config = require("./screeps.json")[env];
  } catch {
    grunt.fail.fatal(
      `Unable to load screeps.json (env: "${env}"). ` +
        `Copy screeps.json.example to screeps.json and fill in your credentials.`,
    );
  }

  if (!config) {
    grunt.fail.fatal(
      `No "${env}" environment found in screeps.json. ` +
        `Available environments: main, ptr, private.`,
    );
  }

  const branch = grunt.option("branch") || config.branch || "default";

  grunt.log.writeln(`Deploying to environment: ${env}`);
  grunt.log.writeln(`Branch: ${branch}`);

  grunt.loadNpmTasks("grunt-contrib-clean");
  grunt.loadNpmTasks("grunt-screeps");

  const screepsOptions = {
    email: config.email,
    password: config.password,
    token: config.token,
    branch: branch,
  };

  if (env === "ptr") {
    screepsOptions.ptr = true;
  } else if (env === "private") {
    screepsOptions.server = {
      host: config.hostname || "127.0.0.1",
      port: config.port || 21025,
      path: config.path || "/api/user/code",
      http: (config.protocol || "http") === "http",
    };
  }

  grunt.registerTask(
    "build",
    "Bundle TypeScript into dist/main.js",
    function () {
      const done = this.async();
      require("node:child_process").exec(
        "npm run build",
        (error, stdout, stderr) => {
          if (error) {
            grunt.log.error(stderr);
            grunt.fail.fatal(error);
            return;
          }
          grunt.log.writeln(stdout);
          done();
        },
      );
    },
  );

  grunt.initConfig({
    clean: {
      dist: ["dist/"],
    },

    screeps: {
      options: screepsOptions,
      dist: {
        src: ["dist/main.js"],
      },
    },
  });

  grunt.registerTask("default", ["clean", "build", "screeps"]);
  grunt.registerTask("push", ["default"]);
  grunt.registerTask("ptr", ["clean", "build", "screeps"]);
  grunt.registerTask("private", ["clean", "build", "screeps"]);
};
