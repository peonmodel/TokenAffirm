// Import Tinytest from the tinytest Meteor package.
import { Tinytest } from "meteor/tinytest";

// Import and rename a variable exported by tokenaffirm.js.
import { name as packageName } from "meteor/freelancecourtyard:tokenaffirm";

// Write your tests here!
// Here is an example.
Tinytest.add('tokenaffirm - example', function (test) {
  test.equal(packageName, "tokenaffirm");
});
