let workout_json_path = "Workouts/jokkeri_ventti.json";
let exercises;
// Read workout from file
$.ajax({ url: workout_json_path,
    dataType: 'json',
    async: false, // Set it to synchronous
    success: function(workout) { exercises = workout.exercises; }
});

let currentExercise = 0; // Index of the current exercise
let workoutDone = 0;
let intervalId = 0;

// Initial values to have time to set down phone
let exercise_name       = exercises[currentExercise].name;
let pauseTimer          = 10; // adjust this;
let currentSet          = 0;
let workoutTimer        = 0;
let pauseState          = 1;

// Get audio elements
const startSound        = new Audio('long_beep.mp3');
const almostPauseSound  = new Audio('almostSound.mp3');
const almostStartSound  = new Audio('almostSound.mp3');
const pauseSound        = new Audio('short_beep.mp3');
const intermediateSound = new Audio('intermediateSound.mp3');

// Intermediate sounds
let intermBeeps;         // Sorted list of intermediate beeps
let intermBeeps_idx = -1; // Current index

// Colors
const COLOR_REST    = "#ffe7cd";
const COLOR_WORKOUT = "#d7ffce";

// State-machine states
let state = 0;
const STATE_NEW_SET   = 0;
const STATE_WORKOUT = 1;
const STATE_REST = 2;

async function requestWakeLock() {
    try {
        wakeLock = await navigator.wakeLock.request('screen');
        //console.log('Screen wake lock acquired');
    } catch (err) {
        console.error(`Error while acquiring wake lock: ${err}`);
    }
}

async function releaseWakeLock() {
    if (wakeLock !== null) {
        await wakeLock.release();
        wakeLock = null;
        console.log('Screen wake lock released');
    }
}

function updateUI() {
    if (workoutDone === 1){
        return;
    }
    if (currentExercise >= exercises.length) {
        return;
    }
    // Update progress bar
    const progressBar = document.getElementById("progress-bar");
    // Target text
    let timer_text = "";
    // Change color when in pause state
    if (pauseState === 0) {
        timer_text = `${workoutTimer}`;
        const totalTime = exercises[currentExercise].workoutTime;
        const progressPercentage = ((totalTime - workoutTimer) / totalTime) * 100;
        progressBar.style.width = `${progressPercentage}%`;
        progressBar.style.backgroundColor = '#4caf50'; // Reset to the workout color
    } else {
        timer_text = `${pauseTimer}`;
        const totalTime = exercises[currentExercise].pauseTime;
        const progressPercentage = (pauseTimer / totalTime) * 100;
        progressBar.style.width = `${progressPercentage}%`;
        progressBar.style.backgroundColor = '#ff9800'; // Change to your desired color
    }

    // Update text: Initial start phase
    if (currentSet === 0) {
        document.getElementById("exercise-count").innerText = `Next`
        document.getElementById("exercise-name").innerText = `${exercises[currentExercise].name}`;
    }
    // Update text: Last set pause
    else if (pauseState === 1 && currentSet === exercises[currentExercise].setCount && currentExercise < exercises.length-1) {
        document.getElementById("exercise-count").innerText = `Next`
        document.getElementById("exercise-name").innerText = `${exercises[currentExercise+1].name}`;
    }
    // Update text: Normal
    else {
        document.getElementById("exercise-count").innerText = `Exercise ${currentExercise+1} of ${exercises.length}`
        document.getElementById("exercise-name").innerText = exercise_name;
    }
    // Display next exercise when last pause of a set
    document.getElementById("set-count").innerText = `Set ${currentSet} of ${exercises[currentExercise].setCount}`;

    document.getElementById("timer").innerText = timer_text;
}

function finished() {
    releaseWakeLock();
    clearInterval(intervalId);
    document.getElementById("exercise-count").innerText = `Exercise ${currentExercise} of ${exercises.length}`
    document.getElementById("exercise-name").innerText = "Workout Done";
    document.getElementById("timer").innerText = "";
    document.getElementById("set-count").innerText = "";
}

function nextExercise() {
    currentSet = 1;
    currentExercise++;
    if (currentExercise >= exercises.length) {
        currentExercise = exercises.length;
        // Workout completed
        finished();
        return;
    } else {
        workoutTimer = exercises[currentExercise].workoutTime;
        pauseTimer = exercises[currentExercise].pauseTime;
    }
    pauseState = 0; // Reset pause state
    updateUI();
}

// Separate function to update sound based on current exercise and set
function updateSound() {
    if (state == STATE_NEW_SET){
        // Set exercise start sound
        if (pauseState === 0 && workoutTimer === exercises[currentExercise].workoutTime)
            startSound.play();
        // Setup intermediate sound variables
        intermBeeps_idx = -1; // Reset index
        intermBeeps = exercises[currentExercise].intermediateBeeps;
        // Check if the exercise has intermediate beep field in json
        if (typeof intermBeeps !== 'undefined') {
            intermBeeps_idx = intermBeeps.length-1;
            // Sort timing array
            intermBeeps = intermBeeps.sort(function(a, b) { return a - b; });
        }
    }
    else if (state == STATE_WORKOUT) {
        // Play pause sound when set done
        if (workoutTimer === 0)
            pauseSound.play();
        // Play sound last few seconds
        else if (workoutTimer <= 3 && workoutTimer > 0)
            almostPauseSound.play();
        // Play intermediate sounds
        if (intermBeeps_idx >= 0){
            if (workoutTimer <= intermBeeps[intermBeeps_idx]) {
                intermediateSound.play();
                intermBeeps_idx--;
            }
        }
    }
    // Pause timer. On last set of last exercise, skip pause.
    else if (state == STATE_REST) {
        // Play sound before pause end
        if (pauseTimer <= 3 && pauseTimer > 0)
            almostStartSound.play();
    }
}

function updateColors() {
    // Background color
    if (state == STATE_NEW_SET){
        document.body.style.backgroundColor = COLOR_WORKOUT;
    }
    else if (state == STATE_REST) {
        document.body.style.backgroundColor = COLOR_REST;
    }
    else if (state == STATE_WORKOUT){
        if (workoutTimer > 0)
            document.body.style.backgroundColor = COLOR_WORKOUT;
        else
            document.body.style.backgroundColor = COLOR_REST;
    }
}

function statemachine() {
    // Main state machine
    if (workoutTimer > 0) {
        pauseState = 0;
        workoutTimer--;
        state = STATE_WORKOUT;
    }
    // Pause timer. On last set of last exercise, skip pause.
    else if (pauseTimer - 1 > 0 && currentExercise < exercises.length-1) {
        pauseState = 1;
        pauseTimer--;
        state = STATE_REST;
    }
    else {
        currentSet++;
        if (currentSet > exercises[currentExercise].setCount) {
            nextExercise();
        } else {
            workoutTimer = exercises[currentExercise].workoutTime;
            pauseTimer = exercises[currentExercise].pauseTime;
        }
        //
        if (currentExercise < exercises.length) {
            exercise_name = exercises[currentExercise].name;
        }
        pauseState = 0;
        state = STATE_NEW_SET;
    }
    // Update
    updateSound();
    updateUI();
    updateColors();
}

function startWorkout() {
    requestWakeLock();

    updateUI();

    workoutDone = 0;
    intervalId = setInterval(() => {
        // TODO: Don't constantly request wake lock, only lock when needed.
        //       1. When workout starts.
        //       2. When user changes focus from the tab and comes back.
        requestWakeLock();
        //
        statemachine();
    }, 1000);
}

// Must play sound by user request as modern browsers
// don't allow playing sound without user request.
document.addEventListener('click', () => {
    // Play sound to user click
    pauseSound.play();
    // Hide welcome text
    document.getElementById("welcomeText").hidden = true;
    // Un-hide progress bar
    document.getElementById("progress-bar").hidden = false;
    //
    startWorkout();
}, { once: true });
