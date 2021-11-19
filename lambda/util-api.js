const { default: axios } = require("axios");
const apiaudio = require("apiaudio").default;
apiaudio.configure({ apiKey: process.env.API_KEY });
const SCRIPT_JSON_ENDPOINT = "https://asset-store-prod.s3.eu-west-1.amazonaws.com/aflorithmic/night_zookeeper/scripts.json";


module.exports.getScriptList = async function () {
  try {
    const { data } = await axios.get(SCRIPT_JSON_ENDPOINT);
    const { scripts } = data;
    return scripts;
  } catch (ex) {
    console.log(ex);
    return ["florence_final_alexa"];
  }
};

async function getScripts() {
  try {
    let scripts_list = await apiaudio.Script.list();
    let scripts = scripts_list.map(({ scriptName, scriptId }) => ({ scriptName, scriptId }));
    return scripts;
  } catch (ex) {
    console.log(ex);
    return ["dd23b5d1-5eef-4f16-b55c-fdb8e9550622"];
  }
}

module.exports.getMastering = async function (
  username = "",
  script = "florence_final_alexa"
) {
  try {
    const scripts = await getScripts();
    let scriptId = scripts.find(obj => obj.scriptName === script).scriptId;
    const masteringResult = await apiaudio.Mastering.retrieve(scriptId, { "username": username });
    return { url: masteringResult.url, script };
  } catch (e) {
    console.error(e);
    return e
  }
}
