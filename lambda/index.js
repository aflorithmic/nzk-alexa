// This sample demonstrates handling intents from an Alexa skill using the Alexa Skills Kit SDK (v2).
// Please visit https://alexa.design/cookbook for additional examples on implementing slots, dialog management,
// session persistence, api calls, and more.
const Alexa = require("ask-sdk");
const AWS = require("aws-sdk");
const ddbAdapter = require("ask-sdk-dynamodb-persistence-adapter");
const { getHandshakeResult } = require("./util");
const { dynamoDBTableName } = require("./constants");

const DEFAULT_REPROMPT = "You can say, open night zookeeper, to begin.";
const QUESTION_REPROMPT = "I am listening to you";
const ERROR_QUESTION_REPROMPT =
  "Sorry, I don't understand you. You can say, for example, my animal is Alex.";

const SCRIPT_LIST = ["florence_final_alexa", "green_panda_alexa", "robot_lion_alexa"];

/*
    Function to demonstrate how to filter inSkillProduct list to get list of
    all entitled products to render Skill CX accordingly
*/
function getAllEntitledProducts(inSkillProductList) {
  const entitledProductList = inSkillProductList.filter((record) => record.entitled === "ENTITLED");
  return entitledProductList;
}

/*
    Helper function that returns a speakable list of product names from a list of
    entitled products.
*/
function getSpeakableListOfProducts(entitleProductsList) {
  const productNameList = entitleProductsList.map((item) => item.name);
  let productListSpeech = productNameList.join(", "); // Generate a single string with comma separated product names
  productListSpeech = productListSpeech.replace(/_([^_]*)$/, "and $1"); // Replace last comma with an 'and '
  return productListSpeech;
}

async function isKidsPlusUser(handlerInput) {
  const locale = handlerInput.requestEnvelope.request.locale;
  const ms = handlerInput.serviceClientFactory.getMonetizationServiceClient();

  const query = await getQuery(handlerInput);
  if (query && query.toLowerCase() === "bob") {
    return true;
  }

  return new Promise((res, rej) => {
    ms.getInSkillProducts(locale).then(
      function reportPurchasedProducts(result) {
        const entitledProducts = getAllEntitledProducts(result.inSkillProducts);
        if (entitledProducts && entitledProducts.length > 0) {
          // Customer owns one or more products
          console.log("there are entitledProducts");
          res(true);
        } else {
          // Not entitled to anything yet.
          console.log("No entitledProducts");
          res(false);
        }
      },
      function reportPurchasedProductsError(err) {
        console.log(`Error calling InSkillProducts API: ${err}`);
        rej(err);
      }
    );
  });
}

function getRandomWelcomeMessage() {
  try {
    const init =
      ' <amazon:emotion name="excited" intensity="medium"> Hello! Welcome to Night Zookeeper Write and Draw. </amazon:emotion> The new Night Zookeeper Alexa Skill. ';
    const items = [
      ' <amazon:domain name="fun"> Sing like a bird to get started! </amazon:domain> <break time="3s"/>',
      ' <amazon:domain name="fun"> Nay like a horse to get started! </amazon:domain> <break time="3s"/>',
      ' <amazon:domain name="fun"> Roar like a lion to get started! </amazon:domain> <break time="3s"/>'
    ];
    const question =
      ' <amazon:emotion name="excited" intensity="high"> Brilliant! Now, <break time="800ms"/> What is the name of the magical animal that we are going to create together tonight? </amazon:emotion> For example, <emphasis level="strong"> <break time="400ms"/> My animal is </emphasis> Luca. What is yours?';
    const randomScript = items[Math.floor(Math.random() * items.length)];
    console.log("🚀 ~ randomScript", randomScript);
    const message = init + randomScript + question;
    return message;
  } catch (ex) {
    console.log(ex);
    throw ex;
  }
}

async function prepareInitialResponse(handlerInput) {
  const playbackInfo = await getPlaybackInfo(handlerInput);
  let message = getRandomWelcomeMessage();
  let reprompt = QUESTION_REPROMPT;

  if (playbackInfo.hasPreviousPlaybackSession) {
    playbackInfo.inPlaybackSession = false;
    message = `You were listening for ${playbackInfo.query}. Would you like to resume?`;
    reprompt = "You can say yes to resume or no to play from the beginning.";
  }

  return handlerInput.responseBuilder.speak(message).reprompt(reprompt).getResponse();
}

async function shouldEnqueue(handlerInput, playbackInfo) {
  // adding new directive to add new track if kids plus user
  const isKidsPlus = await isKidsPlusUser(handlerInput);

  console.log("should enqueue function, isKidsPlus ", isKidsPlus);

  if (isKidsPlus) {
    console.log("should enqueue function ~ playback info ==>", playbackInfo);

    if (playbackInfo.index === SCRIPT_LIST.length) {
      console.log("end of script list, wont play a next song");
      // the end of scripts
      return false;
    }

    const nextIndex = playbackInfo.index + 1;
    const nextScript = SCRIPT_LIST[nextIndex];
    const expectedPreviousToken = playbackInfo.token;
    const offsetInMilliseconds = 0;
    const playBehavior = "ENQUEUE";

    const query = await getQuery(handlerInput);
    const { url } = await getHandshakeResult(query, nextScript);

    console.log("next audio data ==>");
    console.log({
      nextIndex,
      nextScript,
      expectedPreviousToken,
      offsetInMilliseconds,
      query,
      url
    });

    return [
      playBehavior,
      url,
      `url-${url}-index-${nextIndex}`,
      offsetInMilliseconds,
      expectedPreviousToken
    ];
  } else {
    return false;
  }
}

const LaunchRequestHandler = {
  canHandle(handlerInput) {
    return Alexa.getRequestType(handlerInput.requestEnvelope) === "LaunchRequest";
  },
  async handle(handlerInput) {
    console.log("LaunchRequestHandler");
    console.log(handlerInput);

    try {
      const isKidsPlus = await isKidsPlusUser(handlerInput);
      console.log(
        "🚀 ~ file: index.js ~ line 157 ~ handle ~ LaunchRequestHandler isKidsPlus? ",
        isKidsPlus
      );
      return prepareInitialResponse(handlerInput);
    } catch (e) {
      console.log("error in the LaunchRequestHandler");
      console.log(e);
      return handlerInput.responseBuilder
        .speak("Something went wrong in loading your purchase history")
        .getResponse();
    }
  }
};

const CheckAudioInterfaceHandler = {
  async canHandle(handlerInput) {
    const audioPlayerInterface = (
      (((handlerInput.requestEnvelope.context || {}).System || {}).device || {})
        .supportedInterfaces || {}
    ).AudioPlayer;
    return audioPlayerInterface === undefined;
  },
  handle(handlerInput) {
    return handlerInput.responseBuilder
      .speak("Sorry, this skill is not supported on this device")
      .withShouldEndSession(true)
      .getResponse();
  }
};

const HelpIntentHandler = {
  canHandle(handlerInput) {
    return (
      Alexa.getRequestType(handlerInput.requestEnvelope) === "IntentRequest" &&
      Alexa.getIntentName(handlerInput.requestEnvelope) === "AMAZON.HelpIntent"
    );
  },
  handle(handlerInput) {
    const speakOutput =
      "Welcome to Night Zookeeper, a kids skill to write and draw with your favourite animals. To get started just say, alexa open, and the name of your animal. For example, say, alexa open Alex";

    return handlerInput.responseBuilder.speak(speakOutput).reprompt(speakOutput).getResponse();
  }
};

const CancelAndStopIntentHandler = {
  canHandle(handlerInput) {
    return (
      Alexa.getRequestType(handlerInput.requestEnvelope) === "IntentRequest" &&
      (Alexa.getIntentName(handlerInput.requestEnvelope) === "AMAZON.CancelIntent" ||
        Alexa.getIntentName(handlerInput.requestEnvelope) === "AMAZON.StopIntent")
    );
  },
  handle(handlerInput) {
    console.log("CancelAndStopIntentHandler");
    return handlerInput.responseBuilder.speak("Goodbye").withShouldEndSession(true).getResponse();
  }
};

const PauseIntentHandler = {
  canHandle(handlerInput) {
    return (
      Alexa.getRequestType(handlerInput.requestEnvelope) === "IntentRequest" &&
      Alexa.getIntentName(handlerInput.requestEnvelope) === "AMAZON.PauseIntent"
    );
  },
  handle(handlerInput) {
    console.log("PauseIntentHandler");
    return controller.stop(handlerInput, "Pausing ");
  }
};

const SystemExceptionHandler = {
  canHandle(handlerInput) {
    return handlerInput.requestEnvelope.request.type === "System.ExceptionEncountered";
  },
  handle(handlerInput) {
    console.log("SystemExceptionHandler");
    console.log(JSON.stringify(handlerInput.requestEnvelope, null, 2));
    console.log(`System exception encountered: ${handlerInput.requestEnvelope.request.reason}`);
    return handlerInput.responseBuilder
      .speak("Sorry, I have encountered an exception. Maybe I need to sleep a bit.")
      .withShouldEndSession(true)
      .getResponse();
  }
};

const SessionEndedRequestHandler = {
  canHandle(handlerInput) {
    return Alexa.getRequestType(handlerInput.requestEnvelope) === "SessionEndedRequest";
  },
  handle(handlerInput) {
    console.log("SessionEndedRequestHandler");
    // Any cleanup logic goes here.
    return handlerInput.responseBuilder.getResponse();
  }
};

const PlaySoundIntentHandler = {
  async canHandle(handlerInput) {
    const playbackInfo = await getPlaybackInfo(handlerInput);

    if (!playbackInfo.inPlaybackSession) {
      return (
        Alexa.getRequestType(handlerInput.requestEnvelope) === "IntentRequest" &&
        Alexa.getIntentName(handlerInput.requestEnvelope) === "PlaySoundIntent"
      );
    }
    if (
      Alexa.getRequestType(handlerInput.requestEnvelope) === "PlaybackController.PlayCommandIssued"
    ) {
      return true;
    }
  },
  handle(handlerInput) {
    console.log("PlaySound");
    const speechText = handlerInput.requestEnvelope.request.intent.slots.nameQuery.value;
    if (speechText) {
      return controller.search(handlerInput, speechText);
    } else {
      return handlerInput.responseBuilder.speak(ERROR_QUESTION_REPROMPT).getResponse();
    }
  }
};

const ResumePlaybackIntentHandler = {
  async canHandle(handlerInput) {
    const playbackInfo = await getPlaybackInfo(handlerInput);

    return (
      playbackInfo.inPlaybackSession &&
      Alexa.getRequestType(handlerInput.requestEnvelope) === "IntentRequest" &&
      (Alexa.getIntentName(handlerInput.requestEnvelope) === "AMAZON.PlayIntent" ||
        Alexa.getIntentName(handlerInput.requestEnvelope) === "AMAZON.ResumeIntent")
    );
  },
  handle(handlerInput) {
    return controller.play(handlerInput, "Resuming ");
  }
};

// it can be triggered in two cases:
// 1. user paused the music and wanna continue now
// 2. users wants to draw another animal
const YesIntentHandler = {
  async canHandle(handlerInput) {
    return (
      Alexa.getRequestType(handlerInput.requestEnvelope) === "IntentRequest" &&
      Alexa.getIntentName(handlerInput.requestEnvelope) === "AMAZON.YesIntent"
    );
  },
  async handle(handlerInput) {
    console.log("YesHandler");
    const playbackInfo = await getPlaybackInfo(handlerInput);

    if (playbackInfo.inPlaybackSession) {
      // user wants to draw another animal
      const message = "It is great you want to draw again. What is yours next animal?";
      const reprompt = DEFAULT_REPROMPT;
      return handlerInput.responseBuilder.speak(message).reprompt(reprompt).getResponse();
    } else {
      // user wants to resume the paused session
      return controller.play(handlerInput, "Resuming");
    }
  }
};

// it can be triggered in two cases:
// 1. user paused the music and doesnt wanna continue
// 2. users doesnt wanna draw another animal
const NoIntentHandler = {
  async canHandle(handlerInput) {
    return (
      Alexa.getRequestType(handlerInput.requestEnvelope) === "IntentRequest" &&
      Alexa.getIntentName(handlerInput.requestEnvelope) === "AMAZON.NoIntent"
    );
  },
  async handle(handlerInput) {
    console.log("NoHandler");

    const playbackInfo = await getPlaybackInfo(handlerInput);

    if (playbackInfo.inPlaybackSession) {
      // users doesnt wanna draw another animal
      return handlerInput.responseBuilder.speak("Goodbye").withShouldEndSession(true).getResponse();
    } else {
      // user paused the music and doesnt wanna continue
      playbackInfo.offsetInMilliseconds = 0;
      return handlerInput.responseBuilder
        .speak(getRandomWelcomeMessage())
        .reprompt(DEFAULT_REPROMPT)
        .getResponse();
    }
  }
};

/**
 * Handle Audio Player Events
 */
const AudioPlayerEventHandler = {
  canHandle(handlerInput) {
    return handlerInput.requestEnvelope.request.type.startsWith("AudioPlayer.");
  },
  async handle(handlerInput) {
    const { requestEnvelope, responseBuilder } = handlerInput;
    const audioPlayerEventName = requestEnvelope.request.type.split(".")[1];
    const playbackInfo = await getPlaybackInfo(handlerInput);

    console.log("AudioPlayerEventHandler");
    console.log(audioPlayerEventName);
    switch (audioPlayerEventName) {
      case "PlaybackStarted":
        playbackInfo.token = getToken(handlerInput);
        const index = await getIndex(handlerInput);
        playbackInfo.index = index;
        playbackInfo.playedScripts = [
          ...new Set([].concat([...playbackInfo.playedScripts, SCRIPT_LIST[index]]))
        ];
        playbackInfo.inPlaybackSession = true;
        playbackInfo.hasPreviousPlaybackSession = true;
        break;
      case "PlaybackFinished":
        playbackInfo.inPlaybackSession = false;
        playbackInfo.hasPreviousPlaybackSession = false;
        await setNextIndex(playbackInfo);
        break;
      case "PlaybackStopped":
        console.log("stopping, offset is ", getOffsetInMilliseconds(handlerInput));
        playbackInfo.offsetInMilliseconds = getOffsetInMilliseconds(handlerInput);
        playbackInfo.token = getToken(handlerInput);
        playbackInfo.index = await getIndex(handlerInput);
        break;
      case "PlaybackNearlyFinished":
        const queueData = await shouldEnqueue(handlerInput, playbackInfo);

        if (!queueData) {
          console.log("not enqueing next track");
        } else {
          console.log("enqueing next track");
          responseBuilder.addAudioPlayerPlayDirective(...queueData);
        }

        break;
      case "PlaybackFailed":
        playbackInfo.inPlaybackSession = false;
        console.log(`Playback Failed: ${handlerInput.requestEnvelope.request.error}`);
        break;
      default:
        throw new Error("Should never reach here!");
    }

    return responseBuilder.getResponse();
  }
};

// Generic error handling to capture any syntax or routing errors. If you receive an error
// stating the request handler chain is not found, you have not implemented a handler for
// the intent being invoked or included it in the skill builder below.
const ErrorHandler = {
  canHandle(handlerInput) {
    console.log(handlerInput.requestEnvelope.request.type);
    return true;
  },
  handle(handlerInput, error) {
    console.log("ErrorHandler");
    console.log(error);
    console.log(`Error handled: ${error.message}`);
    const message = ERROR_QUESTION_REPROMPT;

    return handlerInput.responseBuilder.speak(message).reprompt(message).getResponse();
  }
};

// Interceptors

const LoadPersistentAttributesRequestInterceptor = {
  async process(handlerInput) {
    let persistentAttributes = {};
    try {
      persistentAttributes = await handlerInput.attributesManager.getPersistentAttributes();
    } catch (e) {
      console.log(e);
      console.log(handlerInput);
    }

    // Check if user is invoking the skill the first time and initialize preset values
    if (Object.keys(persistentAttributes).length === 0) {
      handlerInput.attributesManager.setPersistentAttributes({
        playbackInfo: {
          playedScripts: [],
          offsetInMilliseconds: 0,
          query: "",
          url: "",
          inPlaybackSession: false,
          hasPreviousPlaybackSession: false,
          token: "",
          index: 0
        }
      });
    }
  }
};

const SavePersistentAttributesResponseInterceptor = {
  async process(handlerInput) {
    await handlerInput.attributesManager.savePersistentAttributes();
  }
};

// Helpers

const getToken = (handlerInput) => {
  // Extracting token received in the request.
  return handlerInput.requestEnvelope.request.token;
};

async function getIndex(handlerInput) {
  const attributes = await handlerInput.attributesManager.getPersistentAttributes();
  return attributes.playbackInfo.index;
}

async function getQuery(handlerInput) {
  const attributes = await handlerInput.attributesManager.getPersistentAttributes();
  return attributes.playbackInfo.query;
}

async function setNextIndex(playbackInfo) {
  playbackInfo.index = playbackInfo.index + 1;
}

const getPlaybackInfo = async (handlerInput) => {
  const attributes = await handlerInput.attributesManager.getPersistentAttributes();
  return attributes.playbackInfo;
};

const getOffsetInMilliseconds = (handlerInput) => {
  // Extracting offsetInMilliseconds received in the request.
  return handlerInput.requestEnvelope.request.offsetInMilliseconds;
};

const controller = {
  async search(handlerInput, query) {
    console.log("Search");
    console.log(query);
    const { url, script } = await getHandshakeResult(query, SCRIPT_LIST[0]);
    const playbackInfo = await getPlaybackInfo(handlerInput);
    playbackInfo.url = url;
    playbackInfo.offsetInMilliseconds = 0;
    playbackInfo.query = query;
    playbackInfo.index = 0;
    return this.play(handlerInput, `Playing Night Zookeper Story for ${query} `, {
      url: playbackInfo.url,
      offsetInMilliseconds: playbackInfo.offsetInMilliseconds
    });
  },
  async play(handlerInput, message, afterSearch) {
    console.log("Play");
    console.log(message);
    let url, offsetInMilliseconds, index;
    if (!!afterSearch) {
      url = afterSearch.url;
      offsetInMilliseconds = afterSearch.offsetInMilliseconds;
      index = 0;
    } else {
      const playbackInfo = await getPlaybackInfo(handlerInput);
      url = playbackInfo.url;
      offsetInMilliseconds = playbackInfo.offsetInMilliseconds;
      index = playbackInfo.index;
    }
    console.log("url & offset & index", url, offsetInMilliseconds, index);
    const { responseBuilder } = handlerInput;
    const playBehavior = "REPLACE_ALL";
    return responseBuilder
      .speak(message)
      .withShouldEndSession(true)
      .addAudioPlayerPlayDirective(
        playBehavior,
        url,
        `url-${url}-index-${index}`,
        offsetInMilliseconds,
        null
      )
      .getResponse();
  },
  async stop(handlerInput, message) {
    return handlerInput.responseBuilder
      .speak(message)
      .addAudioPlayerStopDirective()
      .withShouldEndSession(true)
      .getResponse();
  }
};

// The SkillBuilder acts as the entry point for your skill, routing all request and response
// payloads to the handlers above. Make sure any new handlers or interceptors you've
// defined are included below. The order matters - they're processed top to bottom.
exports.handler = Alexa.SkillBuilders.custom()
  .addRequestHandlers(
    CheckAudioInterfaceHandler,
    LaunchRequestHandler,
    PlaySoundIntentHandler,
    SystemExceptionHandler,
    HelpIntentHandler,
    YesIntentHandler,
    NoIntentHandler,
    ResumePlaybackIntentHandler,
    CancelAndStopIntentHandler,
    PauseIntentHandler,
    SessionEndedRequestHandler,
    AudioPlayerEventHandler
  )
  .addRequestInterceptors(LoadPersistentAttributesRequestInterceptor)
  .addResponseInterceptors(SavePersistentAttributesResponseInterceptor)
  .addErrorHandlers(ErrorHandler)
  .withApiClient(new Alexa.DefaultApiClient())
  .withPersistenceAdapter(
    new ddbAdapter.DynamoDbPersistenceAdapter({
      tableName: dynamoDBTableName,
      createTable: false,
      dynamoDBClient: new AWS.DynamoDB({
        apiVersion: "latest",
        region: "eu-west-1"
      })
    })
  )
  .lambda();
