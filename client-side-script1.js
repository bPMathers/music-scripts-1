import noUiSlider from 'nouislider';
import 'nouislider/distribute/nouislider.css';

let midiAccess;
let midiOutput;
let intervalID;

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

let minNote = 0;
let maxNote = 127;
let slider;

window.addEventListener('DOMContentLoaded', () => {
    slider = document.getElementById('slider');

    noUiSlider.create(slider, {
        start: [20, 80],
        connect: true,
        range: {
            min: 0,
            max: 100,
        },
    });
});

// Generate a random MIDI note (within a specific range)
function getRandomMIDINote() {
    const minNote = 60; // Middle C (C4)
    const maxNote = 72; // C5
    return Math.floor(Math.random() * (maxNote - minNote + 1)) + minNote;
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
    }, Math.random() * 1000 + 500); // Random interval between 500ms and 1500ms
}

// Stop generating MIDI notes
function stopGenerating() {
    clearInterval(intervalID);
}

// Event listeners for start and stop buttons
document.getElementById('start').addEventListener('click', startGenerating);
document.getElementById('stop').addEventListener('click', stopGenerating);
