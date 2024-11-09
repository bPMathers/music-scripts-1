import noUiSlider from 'nouislider';
import 'nouislider/dist/nouislider.css';

let minNote = 0;
let maxNote = 127;
let midiAccess;
let midiOutput;
let intervalID;
const defaultPitches = [60, 62, 64, 67, 69];
let midiInputChannel = 1;
let midiOutputChannel = 1;
let debugInput = false;
let debugPitches = false;
let inputDesired = false;
let harmonyDepth = 1;
let harmonyMustBeFull = false;
let lowerDurationBound = 100; // ms
let upperDurationBound = 500; // ms
let silenceProbability = 0; // %
let lowerSilenceBound = 100; // ms
let upperSilenceBound = 300; // ms
let lowerVelocityBound = 50;
let upperVelocityBound = 100;
let playing = false;
let running = true;
let inputBuffer = '';
const noteOnTimes = {}; // For tracking note durations from MIDI input

// // Initial state
// let stateValue = 0;

// // Function to update the state
// function updateState(newValue) {
//     stateValue = newValue;
//     console.log('State updated to:', stateValue);
// }

// // Set up the input field and add an event listener
// const numberInput = document.getElementById('range1-low');
// // numberInput.type = 'number';
// numberInput.value = stateValue; // Set initial value

// // Listen for changes in the input field
// numberInput.addEventListener('input', (event) => {
//     const newValue = Number(event.target.value);
//     updateState(newValue);
// });

let allowedPitches = [];

let isActive = false;

const toggleButton = document.getElementById('toggleButton');
toggleButton.addEventListener('click', () => {
    playing = !playing; // Toggle the value
    toggleButton.textContent = playing ? 'ON' : 'OFF'; // Update button text
    console.log('playing:', playing); // Log the current value
});

const seqButton = document.getElementById('sequenceButton');
seqButton.addEventListener('click', () => {
    playAscendingPentatonicSequence();
});

// script.js
document.addEventListener('DOMContentLoaded', function () {
    const gridContainer = document.getElementById('midi-grid');

    for (let i = 0; i < 128; i++) {
        const cell = document.createElement('div');
        cell.classList.add('cell');
        cell.dataset.note = i; // Set a data attribute to store the MIDI note number

        // Click event to toggle the cell state
        cell.addEventListener('click', function () {
            cell.classList.toggle('active'); // Toggle active class
            const note = cell.dataset.note;
            if (cell.classList.contains('active')) {
                console.log(`MIDI Note ${note} ON`);
                // Add logic to trigger MIDI note ON here
                allowedPitches.push(note);
                console.log(allowedPitches);
            } else {
                console.log(`MIDI Note ${note} OFF`);
                // allowedPitches.delete(note);
                const index = allowedPitches.indexOf(note);
                if (index !== -1) {
                    allowedPitches.splice(index, 1);

                    console.log(`Removed note ${note} from pitches.`);
                } else {
                    console.log(`Note ${note} is not in pitches.`);
                }
                console.log(allowedPitches);
                // Add logic to trigger MIDI note OFF here
            }
        });

        gridContainer.appendChild(cell); // Add the cell to the grid
    }
});

const slider = document.getElementById('dualRangeSlider');

noUiSlider.create(slider, {
    start: [500, 1500],
    connect: true,
    range: {
        min: 10,
        max: 10000,
    },
});

slider.noUiSlider.on('update', function (values) {
    console.log('Low:', values[0], 'High:', values[1]);
    lowerDurationBound = Math.floor(values[0]);
    upperDurationBound = Math.floor(values[1]);
});

// Request MIDI access
navigator.requestMIDIAccess().then(onMIDISuccess, onMIDIFailure);

function onMIDISuccess(midi) {
    midiAccess = midi;

    // Select the first available MIDI output
    midiOutput = Array.from(midiAccess.outputs.values())[0];

    if (midiOutput) {
        console.log('MIDI Output device found:', midiOutput.name);
    } else {
        console.error('No MIDI Output device found.');
    }
}

function onMIDIFailure() {
    console.error('Could not access your MIDI devices.');
}

// Generate a random MIDI note (within a specific range)
function getRandomMIDINote() {
    // const minNote = 60; // Middle C (C4)
    // const maxNote = 72; // C5
    const randomIndex = Math.floor(Math.random() * allowedPitches.length);
    console.log(randomIndex);
    return allowedPitches[randomIndex];
    // return Math.floor(Math.random() * (maxNote - minNote + 1)) + minNote;
}

// Play a MIDI note
function playMIDINote(note) {
    if (midiOutput) {
        const noteOnMessage = [0x90, note, 0x7f]; // Note on message (0x90), max velocity (0x7f)
        const noteOffMessage = [0x80, note, 0x7f]; // Note off message (0x80)
        console.log('about to send --->', noteOnMessage);
        midiOutput.send(noteOnMessage);
        setTimeout(() => midiOutput.send(noteOffMessage), 500); // Note off after 500ms
    }
}

// Start generating random MIDI notes at intervals
function startGenerating() {
    intervalID = setInterval(() => {
        const note = getRandomMIDINote();
        playMIDINote(note);
    }, Math.random() * 500 + 200); // Random interval between 500ms and 1500ms
}

// Stop generating MIDI notes
function stopGenerating() {
    clearInterval(intervalID);
}

// Event listeners for start and stop buttons
document.getElementById('start').addEventListener('click', startGenerating);
document.getElementById('stop').addEventListener('click', stopGenerating);

const generateNotes = async () => {
    console.log('allo --->');
    while (running) {
        if (playing) {
            if (allowedPitches.length > 0) {
                // Decide whether to insert a silence
                const randValue = Math.random() * 100;
                const insertSilence = randValue < silenceProbability;

                if (insertSilence) {
                    // Insert a silence
                    const silenceDuration =
                        lowerSilenceBound +
                        Math.floor(
                            Math.random() *
                                (upperSilenceBound - lowerSilenceBound + 1)
                        );
                    await new Promise((resolve) =>
                        setTimeout(resolve, silenceDuration)
                    );
                } else {
                    let pitchesToPlay;

                    // prevent from adding existing pitch if harmony must be full is true
                    if (harmonyMustBeFull) {
                        pitchesToPlay = [];

                        for (let index = 0; index < harmonyDepth; index++) {
                            let pitchToAdd;

                            if (index > 0) {
                                const filteredAllowedPitches =
                                    allowedPitches.filter(
                                        (pitch) =>
                                            !pitchesToPlay.includes(pitch)
                                    );

                                pitchToAdd =
                                    filteredAllowedPitches[
                                        Math.floor(
                                            Math.random() *
                                                (allowedPitches.length -
                                                    pitchesToPlay.length)
                                        )
                                    ];
                            } else {
                                pitchToAdd =
                                    allowedPitches[
                                        Math.floor(
                                            Math.random() *
                                                (allowedPitches.length -
                                                    pitchesToPlay.length)
                                        )
                                    ];
                            }

                            pitchesToPlay.push(pitchToAdd);
                        }
                    } else {
                        // when !harmonyMustBeFull, number of simultaneously played notes will be between 1 and harmonyDepth, incl.
                        pitchesToPlay = new Set();

                        for (let index = 0; index < harmonyDepth; index++) {
                            pitchesToPlay.add(
                                allowedPitches[
                                    Math.floor(
                                        Math.random() * allowedPitches.length
                                    )
                                ]
                            );
                        }
                    }

                    if (debugPitches) console.log('pitches: ', pitchesToPlay);

                    // Random duration between lower and upper bounds
                    const duration =
                        lowerDurationBound +
                        Math.floor(
                            Math.random() *
                                (upperDurationBound - lowerDurationBound + 1)
                        );

                    // Random velocity between lowerVelocityBound and upperVelocityBound

                    pitchesToPlay.forEach((pitch) => {
                        const velocity =
                            lowerVelocityBound +
                            Math.floor(
                                Math.random() *
                                    (upperVelocityBound -
                                        lowerVelocityBound +
                                        1)
                            );
                        // midiOutput.send([0x90 + midiOutputChannel - 1, pitch, velocity]);
                        // TODO: Ask for which midi channel(s) we want to send to when starting process
                        midiOutput.send([
                            0x90 + midiOutputChannel - 1,
                            pitch,
                            velocity,
                        ]);
                    });

                    // Wait for the note duration
                    await new Promise((resolve) =>
                        setTimeout(resolve, duration)
                    );

                    // Send Note Off messages
                    pitchesToPlay.forEach((pitch) =>
                        midiOutput.send([
                            0x80 + midiOutputChannel - 1,
                            pitch,
                            0,
                        ])
                    );
                }
            } else {
                // No pitches to play; wait briefly
                await new Promise((resolve) => setTimeout(resolve, 100));
            }
        } else {
            // Paused; wait briefly
            await new Promise((resolve) => setTimeout(resolve, 100));
        }
    }
};

// generateNotes();

// Function to generate pentatonic notes over several octaves
function generatePentatonicNotes() {
    const pentatonicIntervals = [0, 2, 4, 7, 9]; // Intervals for C major pentatonic
    const notes = [];
    for (let octave = 2; octave <= 7; octave++) {
        const baseNote = octave * 12; // MIDI note number for C at the given octave
        pentatonicIntervals.forEach((interval) => {
            notes.push(baseNote + interval);
        });
    }
    return notes;
}

// Function to send MIDI Note On message
function sendMidiNoteOn(note) {
    // Replace this with your MIDI send function
    // console.log(`Note On: ${note}`);
    midiOutput.send([0x90, note, 60]);
}

// Function to send MIDI Note Off message
function sendMidiNoteOff(note) {
    // Replace this with your MIDI send function
    // console.log(`Note Off: ${note}`);
    midiOutput.send([0x80, note, 0]);
}

// Main function to play the ascending pentatonic sequence
function playAscendingPentatonicSequence() {
    const pentatonicNotes = generatePentatonicNotes();
    const startTime = Date.now();
    const totalDuration = 60000; // Total sequence duration in milliseconds
    const endTime = startTime + totalDuration;

    function playNextNote() {
        const currentTime = Date.now();
        const t = currentTime - startTime;

        if (currentTime >= endTime) {
            return; // Stop after 30 seconds
        }

        const minNote = 36; // MIDI note number for C2
        const maxNote = 96; // MIDI note number for C7

        // Calculate the target note number that increases over time
        const targetNote = minNote + ((maxNote - minNote) * t) / totalDuration;

        // Assign weights to notes based on their distance from the targetNote
        const noteWeights = pentatonicNotes.map((note) => {
            const distance = Math.abs(note - targetNote);
            // Use an exponential function to assign higher weights to closer notes
            const weight = Math.exp(-distance / 5); // Adjust the divisor to control the spread
            return weight;
        });

        // Normalize weights
        const totalWeight = noteWeights.reduce(
            (sum, weight) => sum + weight,
            0
        );
        const normalizedWeights = noteWeights.map(
            (weight) => weight / totalWeight
        );

        // Select a note based on the weights
        const cumulativeWeights = [];
        normalizedWeights.reduce((sum, weight, i) => {
            cumulativeWeights[i] = sum + weight;
            return cumulativeWeights[i];
        }, 0);

        const randomValue = Math.random();
        let selectedNote;
        for (let i = 0; i < cumulativeWeights.length; i++) {
            if (randomValue <= cumulativeWeights[i]) {
                selectedNote = pentatonicNotes[i];
                break;
            }
        }

        // Random note duration between 10 and 40 ms
        const noteDuration = 100 + Math.random() * (500 - 100);

        // Send MIDI Note On message
        sendMidiNoteOn(selectedNote);

        // Schedule MIDI Note Off message after the note duration
        setTimeout(() => {
            sendMidiNoteOff(selectedNote);
        }, noteDuration);

        // Random delay before the next note (optional)
        const delayBetweenNotes = Math.random() * 100;

        // Schedule the next note
        setTimeout(playNextNote, noteDuration + delayBetweenNotes);
    }

    playNextNote();
}

// playAscendingPentatonicSequence();
