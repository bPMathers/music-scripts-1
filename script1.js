// TODO: add patch state saving and recall.
// TODO: score can be a bunch of set timeouts which trigger some changes on the patch

// These 2 above maybe defeat the purpose of improv...

// TODO: create a random command generator to randomly modify the patch
// TODO: create a bunch bizzaro input devices

import midi from 'midi';
import readline from 'readline';
import {
    printAllowedPitches,
    parseMidiNotes,
    printInstructions,
    waitForStartingPitches,
    waitForInputDesired,
    gatherAndPrintInputs,
    waitForInputSelection,
} from './utils.js';

import { playBirdFlockAscendingSequence } from './one-shots.js';

// Variables
const defaultPitches = [60, 62, 64, 67, 69];
let debugInput = false;
let debugPitches = false;
let inputDesired = false;
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
const noteOnTimes = {}; // For tracking note durations from MIDI input

// List all available output ports
const outputCount = new midi.Output().getPortCount();
const printAvailableOutputPorts = () => {
    console.log('Available MIDI output ports:');
    for (let i = 0; i < outputCount; i++) {
        console.log(`${i}: ${new midi.Output().getPortName(i)}`);
    }
};
printAvailableOutputPorts();

// Create separate output instances for each port
const outputs = [];
const isPortOpen = Array(outputCount).fill(false); // Track if each port is open

for (let i = 0; i < outputCount; i++) {
    const output = new midi.Output();
    outputs.push(output);
}

// State object to track channels assigned to each port
const portChannelMap = {};

// Function to assign a channel to a specific port and open the port if needed
function assignChannelToPort(portIndex, channel) {
    const _channel = parseInt(channel, 10) - 1; // Convert to zero-based index
    if (portIndex < outputCount && _channel >= 0 && _channel <= 15) {
        if (!portChannelMap[portIndex]) {
            portChannelMap[portIndex] = new Set();
        }
        portChannelMap[portIndex].add(_channel);
        console.log(`Assigned channel ${channel} to port ${portIndex}`);

        // Open the port if it's not already open
        if (!isPortOpen[portIndex]) {
            outputs[portIndex].openPort(portIndex);
            isPortOpen[portIndex] = true;
            console.log(`Opened port ${portIndex}`);
        }
    } else {
        console.log('Invalid port index or channel number.');
    }
}

// Function to remove a channel from a specific port
function removeChannelFromPort(portIndex, channel) {
    const _channel = parseInt(channel, 10) - 1; // Convert to zero-based index
    if (portChannelMap[portIndex] && portChannelMap[portIndex].has(_channel)) {
        // send note off for all notes
        for (let note = 0; note < 128; note++) {
            sendMidiNoteOffMessage(portIndex, note, _channel);
        }

        portChannelMap[portIndex].delete(_channel);
        console.log(`Removed channel ${channel} from port ${portIndex}`);

        // Close the port if no channels are assigned to it
        if (portChannelMap[portIndex].size === 0) {
            outputs[portIndex].closePort();
            isPortOpen[portIndex] = false;
            console.log(`Closed port ${portIndex} as no channels are assigned`);
        }
    } else {
        console.log(`Channel ${_channel} is not assigned to port ${portIndex}`);
    }
}

// Function to get the channels assigned to a port
function getChannelsForPort(portIndex) {
    return portChannelMap[portIndex] ?? new Set(); // Return an empty Set if no channels are assigned
}

function printActiveChannels() {
    if (Object.keys(portChannelMap).length === 0) {
        console.log('No active channels.');
        return;
    }

    console.log('*** Active channels ***');
    for (let portIndex = 0; portIndex < outputCount; portIndex++) {
        const channels = getChannelsForPort(portIndex);
        const oneBasedChannels = Array.from(channels).map(
            (channel) => channel + 1
        );
        if (channels.size > 0) {
            console.log(
                `Port: ${portIndex}, channels (1-based): [${Array.from(
                    oneBasedChannels
                ).join(', ')}]`
            );
        }
    }
}

// Function to send a MIDI message to multiple channels on a port
function sendMidiNoteOnMessage(portIndex, note, velocity) {
    if (isPortOpen[portIndex]) {
        const channels = getChannelsForPort(portIndex);
        channels.forEach((channel) => {
            const statusByte = 144 + channel; // 144 is the status byte for note-on messages
            outputs[portIndex].sendMessage([statusByte, note, velocity]);
        });
    }
}

function sendMidiNoteOffMessage(portIndex, note, channel) {
    if (isPortOpen[portIndex]) {
        const channels = channel ? [channel] : getChannelsForPort(portIndex);
        channels.forEach((channel) => {
            const statusByte = 128 + channel; // 128 is the status byte for note-off messages
            outputs[portIndex].sendMessage([statusByte, note, 0]);
        });
    }
}

// Set up MIDI input
// const midiInput = new midi.Input();

// Prompt user to select an output port
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
});

// TODO: Handle MIDI input messages
// midiInput.on('message', (deltaTime, message) => {
//     if (debugInput) console.log('input msg: ', message);
//     const [status, note, velocity] = message;
//     const messageType = status & 0xf0;
//     const channel = status & 0x0f;

//     if (messageType === 0x90 && velocity !== 0) {
//         // Note On
//         noteOnTimes[note] = Date.now();
//     } else if (
//         messageType === 0x80 ||
//         (messageType === 0x90 && velocity === 0)
//     ) {
//         // Note Off
//         const noteOnTime = noteOnTimes[note];
//         if (noteOnTime) {
//             const duration = Date.now() - noteOnTime;
//             delete noteOnTimes[note];
//             if (duration < 1000) {
//                 // Add note
//                 if (!allowedPitches.includes(note)) {
//                     allowedPitches.push(note);

//                     console.log(
//                         `Added note ${note} to pitches (held for ${duration} ms).`
//                     );
//                 }
//             } else {
//                 // Remove note
//                 const index = allowedPitches.indexOf(note);
//                 if (index !== -1) {
//                     allowedPitches.splice(index, 1);

//                     console.log(
//                         `Removed note ${note} from pitches (held for ${duration} ms).`
//                     );
//                 }
//             }
//         }
//     }
// });

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

                        for (let index = 0; index < outputs.length; index++) {
                            sendMidiNoteOnMessage(index, pitch, velocity);
                        }
                    });

                    // Wait for the note duration
                    await new Promise((resolve) =>
                        setTimeout(resolve, duration)
                    );

                    // Send Note Off messages
                    pitchesToPlay.forEach((pitch) => {
                        for (let index = 0; index < outputs.length; index++) {
                            sendMidiNoteOffMessage(index, pitch);
                        }
                    });
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

const handleCommandWithArgs = (input) => {
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
    } else if (cmd === 'bf') {
        const [portIndex, channel] = arg
            .split(',')
            .map((str) => parseInt(str.trim(), 10));

        console.log(
            `Playing bird flock ascending sequence on port ${portIndex}, channel ${channel}`
        );

        playBirdFlockAscendingSequence(undefined, outputs[portIndex], channel);
    } else if (cmd === 'ac') {
        const [portIndex, channel] = arg
            .split(',')
            .map((str) => parseInt(str.trim(), 10));

        if (!isNaN(portIndex) && !isNaN(channel)) {
            assignChannelToPort(portIndex, channel);
        } else {
            console.log('Invalid port index or channel number.');
        }
    } else if (cmd === 'rc') {
        const [portIndex, channel] = arg
            .split(',')
            .map((str) => parseInt(str.trim(), 10));

        if (!isNaN(portIndex) && !isNaN(channel)) {
            removeChannelFromPort(portIndex, channel);
        } else {
            console.log('Invalid port index or channel number.');
        }
    } else if (cmd === 'ps') {
        const value = parseInt(arg.trim(), 10);
        if (!isNaN(value) && value >= 0 && value <= 100) {
            silenceProbability = value;

            console.log(`Set silence probability to ${value}%.`);
        } else {
            console.log('Invalid value for silence probability.');
        }
    } else if (cmd === 'cp') {
        allowedPitches = parseMidiNotes(arg);

        console.log('Set pitches to:');
        printAllowedPitches(allowedPitches);
    } else if (cmd === 'hd') {
        const value = parseInt(arg.trim(), 10);

        if (!isNaN(value) && value >= 1 && value <= 8) {
            harmonyDepth = value;
            console.log(`Harmony depth set to ${value}.`);
        } else {
            console.log('Invalid value for harmony depth.');
        }
    } else if (cmd === 'sl' || cmd === 'su') {
        const value = parseInt(arg.trim(), 10);
        if (!isNaN(value) && value > 0) {
            if (cmd === 'sl') {
                lowerSilenceBound = value;

                console.log(`Set lower silence duration bound to ${value} ms.`);
            } else {
                upperSilenceBound = value;

                console.log(`Set upper silence duration bound to ${value} ms.`);
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
            if (!isNaN(noteNumber) && noteNumber >= 0 && noteNumber <= 127) {
                if (lastChar === '+') {
                    if (!allowedPitches.includes(noteNumber)) {
                        allowedPitches.push(noteNumber);

                        console.log(`Added note ${noteNumber} to pitches.`);
                    } else {
                        console.log(
                            `Note ${noteNumber} is already in pitches.`
                        );
                    }
                } else if (lastChar === '-') {
                    const index = allowedPitches.indexOf(noteNumber);
                    if (index !== -1) {
                        allowedPitches.splice(index, 1);

                        console.log(`Removed note ${noteNumber} from pitches.`);
                    } else {
                        console.log(`Note ${noteNumber} is not in pitches.`);
                    }
                } else {
                    console.log('Invalid command.');
                }
            } else {
                console.log('Invalid MIDI note number.');
            }
        });
    }
};

// Clean up when done (important to prevent port issues)
// TODO: investigate this
process.on('exit', () => {
    outputs.forEach((output, portIndex) => {
        if (isPortOpen[portIndex]) {
            output.closePort();
            console.log(`Closed port ${portIndex}`);
        }
    });
});

// Start the main program
(async () => {
    // inputDesired = await waitForInputDesired(rl);
    // if (inputDesired) {
    //     gatherAndPrintInputs(midiInput);
    //     await waitForInputSelection(rl, midiInput);
    // }
    allowedPitches = await waitForStartingPitches(rl, defaultPitches);
    printInstructions();

    rl.on('line', (inputLine) => {
        const input = inputLine.trim();
        if (input === '') return;

        switch (input) {
            case 's':
                if (!playing) {
                    console.log('Starting note generation...');
                    playing = true;
                }
                break;
            case 'x':
                if (playing) {
                    console.log('Pausing note generation...');
                    playing = false;
                }
                break;
            case 'h':
                printInstructions();
                break;
            case 'q':
                console.log('Quitting program...');
                running = false;
                playing = false;
                rl.close();
                for (let index = 0; index < 128; index++) {
                    for (let i = 0; i < outputs.length; i++) {
                        sendMidiNoteOffMessage(i, index);
                    }
                }
                // midiInput.closePort();
                outputs.forEach((output) => output.closePort());
                process.exit(0);

            case 'l':
                printAllowedPitches(allowedPitches);
                break;

            case 'pa':
                printActiveChannels();
                break;

            case 'pp':
                printAvailableOutputPorts();
                break;

            case 'di':
                debugInput = !debugInput;
                console.log(`setting debugInput to ${debugInput}`);
                break;

            case 'dp':
                debugPitches = !debugPitches;
                console.log(`setting debugPitches to ${debugPitches}`);
                break;

            case 'hf':
                harmonyMustBeFull = !harmonyMustBeFull;
                console.log(
                    `setting harmonyMustBeFull to ${harmonyMustBeFull}`
                );
                break;

            case 'lp':
                const numOutputs = outputs[0].getPortCount();

                if (numOutputs === 0) {
                    console.error('No MIDI output ports available.');
                    process.exit(1);
                }

                // List all available MIDI output ports
                console.log('Available MIDI Output Ports:');
                for (let i = 0; i < numOutputs; i++) {
                    console.log(`Output ${i}: ${outputs[0].getPortName(i)}`);
                }

                break;

            default:
                // any other case, it must be a 2 char command with args
                if (input.length < 2) {
                    console.log('Invalid command.');
                    break;
                }
                handleCommandWithArgs(input);

                break;
        }
    });

    // Main loop for note generation
    generateNotes();
})();
