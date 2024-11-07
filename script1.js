const midi = require('midi');
const readline = require('readline');

// TODO: add patch state saving and recall.
// TODO: score can be a bunch of set timeouts which trigger some changes on the patch

// These 2 above maybe defeat the purpose of improv...

// TODO: create a random command generator to randomly modify the patch
// TODO: create a bunch bizzaro input devices

// Set up MIDI output
const midiOutput = new midi.Output();

// Get the number of available MIDI output ports
const numOutputs = midiOutput.getPortCount();

if (numOutputs === 0) {
    console.error('No MIDI output ports available.');
    process.exit(1);
}

// List all available MIDI output ports
console.log('Available MIDI Output Ports:');
for (let i = 0; i < numOutputs; i++) {
    console.log(`Output ${i}: ${midiOutput.getPortName(i)}`);
}

// Prompt user to select an output port
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
});

const waitForOutputSelection = () => {
    return new Promise((resolve) => {
        rl.question(
            'Enter the index of the MIDI output port you want to use: ',
            (index) => {
                const portIndex = parseInt(index, 10);
                if (
                    isNaN(portIndex) ||
                    portIndex < 0 ||
                    portIndex >= numOutputs
                ) {
                    console.error('Invalid output port index.');
                    process.exit(1);
                }
                midiOutput.openPort(portIndex);
                console.log(
                    `Opened MIDI output port: ${midiOutput.getPortName(
                        portIndex
                    )}`
                );
                resolve();
            }
        );
    });
};

// Set up MIDI input
const midiInput = new midi.Input();

// Get the number of available MIDI input ports
const gatherAndPrintInputs = () => {
    numInputs = midiInput.getPortCount();

    if (numInputs === 0) {
        console.error('No MIDI input ports available.');
        process.exit(1);
    }

    // List all available MIDI input ports
    console.log('\nAvailable MIDI Input Ports:');
    for (let i = 0; i < numInputs; i++) {
        console.log(`Input ${i}: ${midiInput.getPortName(i)}`);
    }
};

// Variables
let debugInput = false;
let debugPitches = false;
let inputDesired = false;
let numInputs;
let harmonyDepth = 1;
let harmonyMustBeFull = false;
let allowedPitches = []; // Starting pitches
let lowerDurationBound = 100; // ms
let upperDurationBound = 500; // ms
let silenceProbability = 20; // %
let lowerSilenceBound = 100; // ms
let upperSilenceBound = 300; // ms
let lowerVelocityBound = 50;
let upperVelocityBound = 100;
let playing = false;
let running = true;
let inputBuffer = '';
const noteOnTimes = {}; // For tracking note durations from MIDI input

const midiToNote = [
    'C',
    'C#',
    'D',
    'D#',
    'E',
    'F',
    'F#',
    'G',
    'G#',
    'A',
    'A#',
    'B',
];

function midiToNoteNames(input) {
    return input.map((midiNumber) => {
        const note = midiToNote[midiNumber % 12]; // Get the note name
        const octave = Math.floor(midiNumber / 12) - 1; // Calculate the octave
        return `${note}${octave}`;
    });
}

const humanNoteToMidiNote = {
    C: 0,
    'C#': 1,
    DB: 1,
    D: 2,
    'D#': 3,
    EB: 3,
    E: 4,
    F: 5,
    'F#': 6,
    GB: 6,
    G: 7,
    'G#': 8,
    AB: 8,
    A: 9,
    'A#': 10,
    BB: 10,
    B: 11,
};

function parseMidiNotes(input) {
    console.log('input --->', input);
    function getMidiNoteNumber(note) {
        const match = note.match(/^([A-Ga-g][#bB]?)(-?\d+)$/);
        if (!match) {
            // throw new Error(`Invalid note format: ${note}`);
            console.log(`--- could not add note: ${input}`);
            return;
        }

        const [_, noteName, octaveStr] = match;
        const midiBase = humanNoteToMidiNote[noteName.toUpperCase()];
        const octave = parseInt(octaveStr, 10);

        return midiBase + (octave + 1) * 12;
    }

    return input.split(',').map((item) => {
        item = item.trim();
        if (/^\d+$/.test(item)) {
            // If the item is a number, parse it as an integer and return
            return parseInt(item, 10);
        } else {
            // Otherwise, treat it as a note name with an octave
            return getMidiNoteNumber(item);
        }
    });
}

const waitForInputDesired = () => {
    return new Promise((resolve) => {
        rl.question('Should we manage MIDI input also ?, y/n: ', (data) => {
            inputDesired = data == 'y';
            resolve();
        });
    });
};

const waitForInputSelection = () => {
    return new Promise((resolve) => {
        rl.question(
            'Enter the index of the MIDI input port you want to use: ',
            (index) => {
                const portIndex = parseInt(index, 10);
                if (
                    isNaN(portIndex) ||
                    portIndex < 0 ||
                    portIndex >= numInputs
                ) {
                    console.error('Invalid input port index.');
                    process.exit(1);
                }
                midiInput.openPort(portIndex);
                console.log(
                    `Opened MIDI input port: ${midiInput.getPortName(
                        portIndex
                    )}`
                );
                resolve();
            }
        );
    });
};

const defaultPitches = [50, 51, 55, 56, 58, 62, 63, 67, 68, 70];

// Prompt user to enter starting pitches
const waitForStartingPitches = () => {
    return new Promise((resolve) => {
        rl.question(
            `Enter starting pitches (MIDI note numbers separated by commas), or press Enter to use default pitches: (${defaultPitches})`,
            (answer) => {
                if (answer.trim() === '') {
                    allowedPitches = defaultPitches;
                } else {
                    const noteNumbers = answer
                        .split(',')
                        .map((str) => str.trim());
                    for (const noteStr of noteNumbers) {
                        const note = parseInt(noteStr, 10);
                        if (isNaN(note) || note < 0 || note > 127) {
                            console.log(
                                `Invalid MIDI note number: ${noteStr}. Must be between 0 and 127.`
                            );
                        } else {
                            allowedPitches.push(note);
                        }
                    }
                    if (allowedPitches.length === 0) {
                        console.log(
                            'No valid pitches entered. Using default pitches.'
                        );
                        allowedPitches = [60, 62, 64, 67, 69];
                    }
                }
                resolve();
            }
        );
    });
};

const printAllowedPitches = () => console.log(midiToNoteNames(allowedPitches));

// User instructions
const printInstructions = () => {
    console.log('\nInstructions:');
    console.log("Press 's' to start, 'x' to pause, 'q' to quit.");
    console.log(
        "To add a pitch: type the comma-separated MIDI note number(s) followed by '+', e.g., '60+' or '69,71+'."
    );
    console.log(
        "To remove a pitch: type the comma-separated MIDI note number(s) followed by '-', e.g., '60-' or '69,71-'."
    );
    console.log(
        "To change lower duration bound: type 'dl' followed by the value, e.g., 'dl100'."
    );
    console.log(
        "To change upper duration bound: type 'du' followed by the value, e.g., 'du500'."
    );
    console.log(
        "To change silence probability: type 'ps' followed by the percentage, e.g., 'ps20' for 20%."
    );
    console.log(
        "To change lower silence duration bound: type 'sl' followed by the value, e.g., 'sl200'."
    );
    console.log(
        "To change upper silence duration bound: type 'su' followed by the value, e.g., 'su600'."
    );
    console.log(
        "To change lower velocity bound: type 'vl' followed by the value, e.g., 'vl40'."
    );
    console.log(
        "To change upper velocity bound: type 'vu' followed by the value, e.g., 'vu120'."
    );
    console.log("To toggle harmonyMustBeFull, type 'hf'");
    console.log("To print instruction like this here, type 'h'");
    console.log("To toggle MIDI input debug, type 'di'");
    console.log("To toggle played pitches debug, type 'dp'");
};

// Handle MIDI input messages
midiInput.on('message', (deltaTime, message) => {
    if (debugInput) console.log('input msg: ', message);
    const [status, note, velocity] = message;
    const messageType = status & 0xf0;
    const channel = status & 0x0f;

    if (messageType === 0x90 && velocity !== 0) {
        // Note On
        noteOnTimes[note] = Date.now();
    } else if (
        messageType === 0x80 ||
        (messageType === 0x90 && velocity === 0)
    ) {
        // Note Off
        const noteOnTime = noteOnTimes[note];
        if (noteOnTime) {
            const duration = Date.now() - noteOnTime;
            delete noteOnTimes[note];
            if (duration < 1000) {
                // Add note
                if (!allowedPitches.includes(note)) {
                    allowedPitches.push(note);

                    console.log(
                        `Added note ${note} to pitches (held for ${duration} ms).`
                    );
                }
            } else {
                // Remove note
                const index = allowedPitches.indexOf(note);
                if (index !== -1) {
                    allowedPitches.splice(index, 1);

                    console.log(
                        `Removed note ${note} from pitches (held for ${duration} ms).`
                    );
                }
            }
        }
    }
});

function stopNote(note) {
    midiOutput.send([0x80, note, 0]); // Send "note off" message with velocity 0
}

// Start the main program
(async () => {
    await waitForOutputSelection();
    await waitForInputDesired();
    if (inputDesired) {
        gatherAndPrintInputs();
        await waitForInputSelection();
    }
    await waitForStartingPitches();
    printInstructions();

    // Set up user input handling
    rl.on('line', (inputLine) => {
        const input = inputLine.trim();
        if (input === '') return;

        if (input === 's') {
            if (!playing) {
                console.log('Starting note generation...');
                playing = true;
            }
        } else if (input === 'x') {
            if (playing) {
                console.log('Pausing note generation...');
                playing = false;
            }
        } else if (input === 'h') {
            printInstructions();
        } else if (input === 'di') {
            debugInput = !debugInput;
            console.log(`setting debugInput to ${debugInput}`);
        } else if (input === 'dp') {
            debugPitches = !debugPitches;
            console.log(`setting debugPitches to ${debugPitches}`);
        } else if (input === 'l') {
            printAllowedPitches();
        } else if (input === 'h') {
            printInstructions();
        } else if (input === 'q') {
            console.log('Quitting program...');
            running = false;
            playing = false;
            rl.close();
            // call stop note with all integers from 0 to 127
            for (let index = 0; index < 128; index++) {
                stopNote(index);
            }
            midiInput.closePort();
            midiOutput.closePort();
            process.exit(0);
        } else {
            // Handle other commands. The should all have 2 chars before the args
            const cmd = input.slice(0, 2);
            const arg = input.slice(2);

            if (cmd === 'dl' || cmd === 'du') {
                const value = parseInt(arg.trim(), 10);
                if (!isNaN(value) && value > 0) {
                    if (cmd === 'dl') {
                        lowerDurationBound = value;

                        console.log(`Set lower duration bound to ${value} ms.`);
                    } else {
                        upperDurationBound = value;

                        console.log(`Set upper duration bound to ${value} ms.`);
                    }
                    if (lowerDurationBound > upperDurationBound) {
                        [lowerDurationBound, upperDurationBound] = [
                            upperDurationBound,
                            lowerDurationBound,
                        ];

                        console.log(
                            'Swapped duration bounds to maintain lower <= upper.'
                        );
                    }
                } else {
                    console.log('Invalid value for duration bound.');
                }
            } else if (cmd === 'ps') {
                const value = parseInt(arg.trim(), 10);
                if (!isNaN(value) && value >= 0 && value <= 100) {
                    silenceProbability = value;

                    console.log(`Set silence probability to ${value}%.`);
                } else {
                    console.log('Invalid value for silence probability.');
                }
            } else if (cmd === 'hd') {
                const value = parseInt(arg.trim(), 10);

                if (!isNaN(value) && value >= 1 && value <= 8) {
                    harmonyDepth = value;
                    console.log(`Harmony depth set to ${value}.`);
                } else {
                    console.log('Invalid value for silence probability.');
                }
            } else if (cmd === 'hf') {
                harmonyMustBeFull = !harmonyMustBeFull;

                console.log(
                    `toggling harmonyMustBeFull to ${harmonyMustBeFull}`
                );
            } else if (cmd === 'sl' || cmd === 'su') {
                const value = parseInt(arg.trim(), 10);
                if (!isNaN(value) && value > 0) {
                    if (cmd === 'sl') {
                        lowerSilenceBound = value;

                        console.log(
                            `Set lower silence duration bound to ${value} ms.`
                        );
                    } else {
                        upperSilenceBound = value;

                        console.log(
                            `Set upper silence duration bound to ${value} ms.`
                        );
                    }
                    if (lowerSilenceBound > upperSilenceBound) {
                        [lowerSilenceBound, upperSilenceBound] = [
                            upperSilenceBound,
                            lowerSilenceBound,
                        ];

                        console.log(
                            'Swapped silence bounds to maintain lower <= upper.'
                        );
                    }
                } else {
                    console.log('Invalid value for silence duration bound.');
                }
            } else if (cmd === 'vl' || cmd === 'vu') {
                const value = parseInt(arg.trim(), 10);
                if (!isNaN(value) && value >= 0 && value <= 127) {
                    if (cmd === 'vl') {
                        lowerVelocityBound = value;

                        console.log(`Set lower velocity bound to ${value}.`);
                    } else {
                        upperVelocityBound = value;

                        console.log(`Set upper velocity bound to ${value}.`);
                    }
                    if (lowerVelocityBound > upperVelocityBound) {
                        [lowerVelocityBound, upperVelocityBound] = [
                            upperVelocityBound,
                            lowerVelocityBound,
                        ];

                        console.log(
                            'Swapped velocity bounds to maintain lower <= upper.'
                        );
                    }
                } else {
                    console.log('Invalid value for velocity bound.');
                }
            } else {
                // Assume it's a note addition or removal
                const lastChar = input.slice(-1);
                const notes = parseMidiNotes(input.slice(0, -1));

                notes.forEach((note) => {
                    console.log('note', note);
                    const noteNumber = parseInt(note, 10);
                    if (
                        !isNaN(noteNumber) &&
                        noteNumber >= 0 &&
                        noteNumber <= 127
                    ) {
                        if (lastChar === '+') {
                            if (!allowedPitches.includes(noteNumber)) {
                                allowedPitches.push(noteNumber);

                                console.log(
                                    `Added note ${noteNumber} to pitches.`
                                );
                            } else {
                                console.log(
                                    `Note ${noteNumber} is already in pitches.`
                                );
                            }
                        } else if (lastChar === '-') {
                            const index = allowedPitches.indexOf(noteNumber);
                            if (index !== -1) {
                                allowedPitches.splice(index, 1);

                                console.log(
                                    `Removed note ${noteNumber} from pitches.`
                                );
                            } else {
                                console.log(
                                    `Note ${noteNumber} is not in pitches.`
                                );
                            }
                        } else {
                            console.log('Invalid command.');
                        }
                    } else {
                        console.log('Invalid MIDI note number.');
                    }
                });
            }
        }
    });

    // Main loop for note generation
    const generateNotes = async () => {
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
                                            Math.random() *
                                                allowedPitches.length
                                        )
                                    ]
                                );
                            }
                        }

                        if (debugPitches)
                            console.log('pitches: ', pitchesToPlay);

                        // Random duration between lower and upper bounds
                        const duration =
                            lowerDurationBound +
                            Math.floor(
                                Math.random() *
                                    (upperDurationBound -
                                        lowerDurationBound +
                                        1)
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
                            midiOutput.sendMessage([0x90, pitch, velocity]);
                        });

                        // Wait for the note duration
                        await new Promise((resolve) =>
                            setTimeout(resolve, duration)
                        );

                        // Send Note Off messages
                        pitchesToPlay.forEach((pitch) =>
                            midiOutput.sendMessage([0x80, pitch, 0])
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

    generateNotes();
})();
