// This sample demonstrates handling intents from an Alexa skill using the Alexa Skills Kit SDK (v2).
// Please visit https://alexa.design/cookbook for additional examples on implementing slots, dialog management,
// session persistence, api calls, and more.
const Alexa = require("ask-sdk-core");
const { getHandshakeResult } = require("./util");
const { dynamoDBTableName } = require("./constants");

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

function prepareInitialResponse() {
  const playbackInfo = await getPlaybackInfo(handlerInput);
  let message = getRandomWelcomeMessage();
  let reprompt = "You can say, open Alex, to begin.";

  if (playbackInfo.hasPreviousPlaybackSession) {
    playbackInfo.inPlaybackSession = false;
    message = `You were listening for ${playbackInfo.query}. Would you like to resume?`;
    reprompt = "You can say yes to resume or no to play from the beginning.";
  }

  return handlerInput.responseBuilder.speak(message).reprompt(reprompt).getResponse();
}

const LaunchRequestHandler = {
  canHandle(handlerInput) {
    return Alexa.getRequestType(handlerInput.requestEnvelope) === "LaunchRequest";
  },
  handle(handlerInput) {
    console.log("LaunchRequestHandler");
    console.log(handlerInput);

    const locale = handlerInput.requestEnvelope.request.locale;
    const ms = handlerInput.serviceClientFactory.getMonetizationServiceClient();

    return ms.getInSkillProducts(locale).then(
      function reportPurchasedProducts(result) {
        const entitledProducts = getAllEntitledProducts(result.inSkillProducts);
        if (entitledProducts && entitledProducts.length > 0) {
          // Customer owns one or more products
          return prepareInitialResponse();
        }
        // Not entitled to anything yet.
        console.log("No entitledProducts");
        return prepareInitialResponse();
      },
      function reportPurchasedProductsError(err) {
        console.log(`Error calling InSkillProducts API: ${err}`);

        return handlerInput.responseBuilder
          .speak("Something went wrong in loading your purchase history")
          .getResponse();
      }
    );
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
    const speakOutput = "You can say hello to me! How can I help?";

    return handlerInput.responseBuilder.speak(speakOutput).reprompt(speakOutput).getResponse();
  }
};

const CancelAndStopIntentHandler = {
  canHandle(handlerInput) {
    return (
      Alexa.getRequestType(handlerInput.requestEnvelope) === "IntentRequest" &&
      (Alexa.getIntentName(handlerInput.requestEnvelope) === "AMAZON.CancelIntent" ||
        Alexa.getIntentName(handlerInput.requestEnvelope) === "AMAZON.StopIntent" ||
        Alexa.getIntentName(handlerInput.requestEnvelope) === "AMAZON.PauseIntent")
    );
  },
  handle(handlerInput) {
    console.log("CancelAndStopIntentHandler");
    // TODO: this should not be always true
    const isKidsPlusUser = true;
    return controller.stop(
      handlerInput,
      isKidsPlusUser ? "Would you like to draw another animal?" : "Goodbye",
      !isKidsPlusUser
    );
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
      return handlerInput.responseBuilder.speak("You can say, open Alex, to begin.").getResponse();
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
      // user wants to draw another animalconst message = "It is great you want to draw again. What is yours next animal?";
      const reprompt = "You can say, open Alex, to begin.";
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
      return controller.play(handlerInput, "Starting Over");
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

    console.log("AudioPlayerEventHandler");
    console.log(audioPlayerEventName);
    switch (audioPlayerEventName) {
      case "PlaybackStarted":
        playbackInfo.inPlaybackSession = true;
        playbackInfo.hasPreviousPlaybackSession = true;
        break;
      case "PlaybackFinished":
        playbackInfo.inPlaybackSession = false;
        playbackInfo.hasPreviousPlaybackSession = false;
        break;
      case "PlaybackStopped":
        playbackInfo.offsetInMilliseconds = getOffsetInMilliseconds(handlerInput);
        break;
      case "PlaybackNearlyFinished":
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
    const message = "Sorry, I don't understand you. You can say, my animal is Trompy the elephant.";

    return handlerInput.responseBuilder.speak(message).reprompt(message).getResponse();
  }
};

// Interceptors

const LoadPersistentAttributesRequestInterceptor = {
  async process(handlerInput) {
    const persistentAttributes = await handlerInput.attributesManager.getPersistentAttributes();

    // Check if user is invoking the skill the first time and initialize preset values
    if (Object.keys(persistentAttributes).length === 0) {
      handlerInput.attributesManager.setPersistentAttributes({
        playbackInfo: {
          playedScripts: [],
          offsetInMilliseconds: 0,
          query: "",
          url: "",
          inPlaybackSession: false,
          hasPreviousPlaybackSession: false
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

const getPlaybackInfo = async (handlerInput) => {
  const attributes = await handlerInput.attributesManager.getPersistentAttributes();
  return attributes.playbackInfo;
};

const getOffsetInMilliseconds = (handlerInput) => {
  // Extracting offsetInMilliseconds received in the request.
  return handlerInput.requestEnvelope.request.offsetInMilliseconds;
};

const controller = {
  async play(handlerInput, query) {
    const url = await getHandshakeResult(query);
    const { responseBuilder } = handlerInput;
    const playBehavior = "REPLACE_ALL";
    console.log("play");
    responseBuilder
      .speak(`Playing Night Zookeper Story for ${query}`)
      .withShouldEndSession(true)
      .addAudioPlayerPlayDirective(playBehavior, url, url, 0, null);
    return responseBuilder.getResponse();
  },
  async stop(handlerInput, message) {
    return handlerInput.responseBuilder.speak(message).addAudioPlayerStopDirective().getResponse();
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
    CancelAndStopIntentHandler,
    SessionEndedRequestHandler,
    AudioPlayerEventHandler
  )
  .withApiClient(new Alexa.DefaultApiClient())
  .addErrorHandlers(ErrorHandler)
  .lambda();
