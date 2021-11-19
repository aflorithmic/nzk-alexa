// compare the two calls (handshake and api.audio) and return true if they are the same
const { getScriptJsonList, getMastering } = require("./lambda/util-api");
const { getHandshakeResult, getScriptList } = require("./lambda/util");

async function main(username, script) {
  let oldcall = await getHandshakeResult(username, script);
  let newcall = await getMastering(username, script);
  console.log(await getScriptList())
  console.log(await getScriptJsonList())
  console.log(oldcall);
  console.log(newcall);
  console.log(Object.keys(oldcall));
  console.log(Object.keys(newcall));
  return JSON.stringify(Object.keys(oldcall)) === JSON.stringify(Object.keys(newcall));
}

main(username="gggg", script="florence_final_alexa")
  .then(function (r) {
      console.log(r)
  })
  .catch(function (error) {
      console.log(error);
  });