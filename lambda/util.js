const { default: axios } = require("axios");

const ORGANIZATION = "aflorithmic";
const PROJECT = "night_zookeeper";
const MODULE = "weekly_story";
const SCRIPT = "florence_final_alexa";

const HANDSHAKE_ENDPOINT = "https://handshake.aflr.io";

module.exports.getHandshakeResult = async function (username = "") {
  try {
    const { data } = await axios.get(HANDSHAKE_ENDPOINT, {
      params: {
        username,
        module: MODULE,
        script: SCRIPT,
        organization: ORGANIZATION,
        project: PROJECT
      }
    });
    const { handshakeTrack } = data;
    console.log("🚀 ~ handshakeTrack", handshakeTrack);
    return { url: handshakeTrack, script: SCRIPT };
  } catch (ex) {
    console.log(ex);
    throw ex;
  }
};
