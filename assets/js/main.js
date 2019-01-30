const MTURK_SUBMIT = "https://www.mturk.com/mturk/externalSubmit";
const SANDBOX_SUBMIT = "https://workersandbox.mturk.com/mturk/externalSubmit";

var config = {};

var state = {
    taskIndex: gup("skipto") ? parseInt(gup("skipto")) : 0,
    taskInputs: {},
    taskOutputs: [],
    assignmentId: gup("assignmentId"),
    workerId: gup("workerId"),
};

/* HELPERS */
function saveTaskData() {
    var data;
    if (isDemoSurvey()) {
        data = demoSurvey.collectData();
    } else {
        data = custom.collectData(getTaskInputs(state.taskIndex), state.taskIndex, getTaskOutputs(state.taskIndex));
    }
    if (config.meta.aggregate) {
        $.extend(state.taskOutputs, data);
    } else {
        // TODO: figure out how best to include the demo survey data in the results?
        state.taskOutputs[state.taskIndex] = data;
    }
}

function getTaskInputs(i) {
    return config.meta.aggregate ? state.taskInputs : state.taskInputs[i];
}

function getTaskOutputs(i) {
    return config.meta.aggregate ? state.taskOutputs : state.taskOutputs[i];
}

function updateTask() {
    if (config.advanced.hideIfNotAccepted && hideIfNotAccepted()) {
        return;
    }
    $("#progress-bar").progress("set progress", state.taskIndex + 1);
    console.log('setting bar progress to:', state.taskIndex + 1)
    if (isDemoSurvey()) {
        demoSurvey.showTask();
    } else {
        // show the user's task
        demoSurvey.hideSurvey();
        $('#custom-experiment').show();
        custom.showTask(getTaskInputs(state.taskIndex), state.taskIndex, getTaskOutputs(state.taskIndex));
    }
    if (state.taskIndex == config.meta.numSubtasks + config.advanced.includeDemographicSurvey - 1) {
        // last page
        $("#next-button").addClass("disabled");
        if (state.taskIndex != 0) {
            $("#prev-button").removeClass("disabled");
        } else {
            $("#prev-button").addClass("disabled");
        }
        $("#submit-button").removeClass("disabled");
        $("#final-task-fields").css("display", "block");
    } else if (state.taskIndex == 0) {
        // first page
        $("#next-button").removeClass("disabled");
        $("#prev-button").addClass("disabled");
        $("#submit-button").addClass("disabled");
        $("#final-task-fields").css("display", "none");
    } else {
        // intermediate page
        $("#next-button").removeClass("disabled");
        $("#prev-button").removeClass("disabled");
        $("#submit-button").addClass("disabled");
        $("#final-task-fields").css("display", "none");
    }
}

function nextTask() {
    if (state.taskIndex < (config.meta.numSubtasks + config.advanced.includeDemographicSurvey) - 1) {
        saveTaskData();

        var failedValidation;
        if (isDemoSurvey()) {
            failedValidation = demoSurvey.validateTask();
        } else {
            failedValidation = custom.validateTask(getTaskInputs(state.taskIndex), state.taskIndex, getTaskOutputs(state.taskIndex));
        }

        if (failedValidation) {
            generateMessage("negative", failedValidation.errorMessage);
        } else {
            state.taskIndex++;
            updateTask();
            clearMessage();
            console.log("Current collected data", state.taskOutputs);
        }
    }
}

function prevTask() {
    if (state.taskIndex > 0) {
        saveTaskData();
        state.taskIndex--;
        updateTask();
    }
}

// function toggleInstructions() {
//     if ($("#experiment").css("display") == "none") {
//         $("#experiment").css("display", "flex");
//         $("#instructions").css("display", "none");
//         // updateTask();
//     } else {
//         // saveTaskData();
//         $("#experiment").css("display", "none");
//         $("#instructions").css("display", "flex");
//     }
// }

function firstTaskShow() {
  $("#experiment").css("display", "flex")
  $("#instructions").css("display", "none");

  $("#progress-bar").progress("set progress", state.taskIndex + 1);
  console.log('setting bar progress to:', state.taskIndex + 1)
}


function clearMessage() {
    $("#message-field").html("");
}

function generateMessage(cls, header) {
  console.log('generating Message with cls and header:',cls,header)
    clearMessage();
    if (!header) return;
    var messageStr = "<div class='ui message " + cls + "'>";
    messageStr += "<i class='close icon'></i>";
    messageStr += "<div class='header'>" + header + "</div></div>";
    console.log('messageStr',messageStr)
    var newMessage = $(messageStr);
    $("#message-field").append(newMessage);
    newMessage.click(function() {
        $(this).closest(".message").transition("fade");
    });
}

function addHiddenField(form, name, value) {
    // form is a jQuery object, name and value are strings
    var input = $("<input type='hidden' name='" + name + "' value=''>");
    input.val(value);
    form.append(input);
}

function hitDone() {
  strokes = custom.collectData()
  if (strokes.length < config.meta.imgsPerFold) {
    return False
  }
  else {
    return True
  }
}

function submitHIT() {

    // if (!hitDone() ) {
    //   $("#hitNotDoneMessage").css("display", "flex");
    //   return;
    // }

    var submitUrl = config.hitCreation.production ? MTURK_SUBMIT : SANDBOX_SUBMIT;
    if (config.advanced.externalSubmit) {
        submitUrl = config.advanced.externalSubmitUrl;
    }
    saveTaskData();
    clearMessage();
    $("#submit-button").addClass("loading");
    for (var i = 0; i < config.meta.numSubtasks; i++) {
        var failedValidation = custom.validateTask(getTaskInputs(i), i, getTaskOutputs(i));
        if (failedValidation) {
            cancelSubmit(failedValidation);
            return;
        }
    }
    if (config.advanced.includeDemographicSurvey) {
        var failedValidation = demoSurvey.validateTask();
        if (failedValidation) {
            cancelSubmit(failedValidation);
            return;
        }
    }

    if (config.advanced.externalSubmit) {
        externalSubmit(submitUrl);
    } else {
        mturkSubmit(submitUrl);
    }
}

function cancelSubmit(err) {
    $("#submit-button").removeClass("loading");
    generateMessage("negative", err);
}

function gup(name) {
    var regexS = "[\\?&]"+name+"=([^&#]*)";
    var regex = new RegExp( regexS );
    var tmpURL = window.location.href;
    var results = regex.exec( tmpURL );
    if (results == null) return "";
    else return results[1];
}

/* SETUP FUNCTIONS */
function populateMetadata(config) {
    $(".meta-title").html(config.meta.title);
    $(".meta-desc").html(config.meta.description);
    $(".instructions-simple").html(config.instructions.simple);
    for (var i = 0; i < config.instructions.steps.length; i++) {
        $(".instructions-steps").append($("<li>" + config.instructions.steps[i] + "</li>"));
    }
    $(".disclaimer").html(config.meta.disclaimer);
    if (config.instructions.images.length > 0) {
        $("#sample-task").css("display", "block");
        var instructionsIndex = Math.floor(Math.random() * config.instructions.images.length);
        var imgEle = "<img class='instructions-img' src='";
        imgEle += config.instructions.images[instructionsIndex] + "'></img>";
        $("#instructions-demo").append($(imgEle));

    }
    console.log('TOTAL FOR PROGRESS BAR:',config.meta.numSubtasks + config.advanced.includeDemographicSurvey)
    $("#progress-bar").progress({
        total: config.meta.numSubtasks + config.advanced.includeDemographicSurvey,
    });
}

function setupButtons() {
    $("#next-button").click(nextTask);
    $("#prev-button").click(prevTask);
    // $(".instruction-button").click(toggleInstructions);
    $(".continue-button").click(firstTaskShow);
    $("#submit-button").click(submitHIT);
    if (state.assignmentId == "ASSIGNMENT_ID_NOT_AVAILABLE") {
        $("#submit-button").remove();
    }
}

/* USEFUL HELPERS */

function isDemoSurvey() {
    var useSurvey = config.advanced.includeDemographicSurvey;
    var lastTask = state.taskIndex == config.meta.numSubtasks + config.advanced.includeDemographicSurvey -1;
    return useSurvey && lastTask;
}

// Hides the task UI if the user is working within an MTurk iframe and has not accepted the task
// Returns true if the task was hidden, false otherwise
function hideIfNotAccepted() {
    if (state.assignmentId == "ASSIGNMENT_ID_NOT_AVAILABLE") {
        console.log("Hiding if not accepted");
        $('#experiment').hide();
        $("#hit-not-accepted").show();
        return true;
    }
    return false;
}

// Code to show the user's validation code; only used if task is configured as an external link
function showSubmitKey(key) {
    $('#submit-code').text(key);
    $('#experiment').hide();
    $('#succesful-submit').show();
    selectText('submit-code');
}

// highlights/selects text within an html element
// copied from:
// https://stackoverflow.com/questions/985272/selecting-text-in-an-element-akin-to-highlighting-with-your-mouse
function selectText(node) {
    node = document.getElementById(node);

    if (document.body.createTextRange) {
        const range = document.body.createTextRange();
        range.moveToElementText(node);
        range.select();
    } else if (window.getSelection) {
        const selection = window.getSelection();
        const range = document.createRange();
        range.selectNodeContents(node);
        selection.removeAllRanges();
        selection.addRange(range);
    } else {
        console.warn("Could not select text in node: Unsupported browser.");
    }
}

/* SUBMIT FUNCTIONS */

// submit to MTurk as a back-end. MTurk only accepts form submissions and frowns
// upon async POSTs.
function mturkSubmit(submitUrl) {
    var form = $("#submit-form");
    addHiddenField(form, 'assignmentId', state.assignmentId);
    addHiddenField(form, 'workerId', state.workerId);
    var results = {
        'inputs': state.taskInputs,
        'outputs': state.taskOutputs
    };
    if (!config.advanced.includeDemographicSurvey) {
        results['feedback'] = $("#feedback-input").val();
    }
    console.log("results", results);
    addHiddenField(form, 'results', JSON.stringify(results));
    addHiddenField(form, 'feedback', $("#feedback-input").val());

    $("#submit-form").attr("action", submitUrl);
    $("#submit-form").attr("method", "POST");
    $("#submit-form").submit();

    $("#submit-button").removeClass("loading");
    generateMessage("positive", "Thanks! Your task was submitted successfully.");
    $("#submit-button").addClass("disabled");
}

// submit to a customized back-end.
function externalSubmit(submitUrl) {
    var payload = {
        'assignmentId': state.assignmentId,
        'workerId': state.workerId,
        'origin': state.origin,
        'results': {
            'inputs': state.taskInputs,
            'outputs': state.taskOutputs
        }
    }
    console.log("payload", payload);
    if (!config.advanced.includeDemographicSurvey) {
        payload.results.feedback = $("#feedback-input").val();
    }
    console.log("submitUrl", submitUrl);

    $.ajax({
        url: submitUrl,
        type: 'POST',
        data: JSON.stringify(payload),
        dataType: 'json'
    }).then(function(response) {
        showSubmitKey(response['key']);
    }).catch(function(error) {
        // This means there was an error connecting to the DEVELOPER'S
        // data collection server.
        // even if there is a bug/connection problem at this point,
        // we want people to be paid.
        // use a consistent prefix so we can pick out problem cases,
        // and include their worker id so we can figure out what happened
        console.log("ERROR", error);
        key = "mturk_key_" + state.workerId + "_" + state.assignmentId;
        showSubmitKey(key);
    })
}


function setupModal() {
  /* FUNCTIONS FOR THE INSTRUCTIONS MODAL */
  // Get the modal
  var modal = document.getElementById('myModal');

  // Get the button that opens the modal
  var btn = document.getElementById("show-instructions");
  // $(".instruction-button").click(function() {
  //   modal.style.display = "block";
  // })

  // Get the <span> element that closes the modal
  var span = document.getElementsByClassName("close")[0];

  // When the user clicks on the button, open the modal
  btn.onclick = function() {
    console.log('instructions button clicked')
    modal.style.display = "block";
  }

  // When the user clicks on <span> (x), close the modal
  span.onclick = function() {
    modal.style.display = "none";
  }

  // When the user clicks anywhere outside of the modal, close it
  window.onclick = function(event) {
    if (event.target == modal) {
      modal.style.display = "none";
    }
  }

}


/* MAIN */
$(document).ready(function() {

    $.getJSON("config.json").done(function(data) {

        config = data;
        if (config.meta.aggregate) {
            state.taskOutputs = {};
        }
        custom.loadTasks(config.meta.numSubtasks).done(function(taskInputs) {
            state.taskInputs = taskInputs;
            populateMetadata(config);
            demoSurvey.maybeLoadSurvey(config);
            setupButtons(config);
            setupModal();
        });
    });
});
