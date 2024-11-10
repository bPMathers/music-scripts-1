export const waitForInputDesired = (rl) => {
    return new Promise((resolve) => {
        rl.question('Should we manage MIDI input also ?, y/n: ', (data) => {
            resolve(data == 'y');
        });
    });
};

export const midiToNote = [
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

export function midiToNoteNames(input) {
    return input.map((midiNumber) => {
        const note = midiToNote[midiNumber % 12]; // Get the note name
        const octave = Math.floor(midiNumber / 12) - 1; // Calculate the octave
        return `${note}${octave}`;
    });
}

export const printAllowedPitches = (allowedPitches) =>
    console.log(midiToNoteNames(allowedPitches));

export const humanNoteToMidiNote = {
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

export function stopNote(note, midiOutput, channel) {
    midiOutput.send([0x80 + channel - 1, note, 0]); // Send "note off" message with velocity 0
}

export function parseMidiNotes(input) {
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

export const waitForOutputPortSelection = (rl, midiOutput) => {
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

export const printInstructions = () => {
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

export const gatherAndPrintMidiPorts = () => {
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
};

export const gatherAndPrintInputs = (midiInput) => {
    const numInputs = midiInput.getPortCount();
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

export const waitForInputSelection = (rl, midiInput) => {
    return new Promise((resolve) => {
        rl.question(
            'Enter the index of the MIDI input port you want to use: ',
            (index) => {
                const portIndex = parseInt(index, 10);
                const numInputs = midiInput.getPortCount();

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

export const waitForOutputChannelSelection = (rl) => {
    return new Promise((resolve) => {
        rl.question(
            'Enter the MIDI channel you want to output to: ',
            (index) => {
                const channel = parseInt(index, 10);
                if (isNaN(channel) || channel < 0 || channel > 16) {
                    console.error('Invalid output port index.');
                    process.exit(1);
                }

                console.log(`MIDI output channel set to: ${channel}`);
                resolve(channel);
            }
        );
    });
};

export const waitForStartingPitches = (rl, defaultPitches) => {
    return new Promise((resolve) => {
        rl.question(
            `Enter starting pitches (MIDI note numbers separated by commas), or press Enter to use default pitches: (${defaultPitches})`,
            (answer) => {
                if (answer.trim() === '') {
                    // allowedPitches = defaultPitches;
                    console.log('came here 1 --');
                    resolve(defaultPitches);
                    return;
                }
                console.log('came here 2 --');

                const noteNumbers = answer.split(',').map((str) => str.trim());
                let pitches = [];
                for (const noteStr of noteNumbers) {
                    const note = parseInt(noteStr, 10);
                    if (isNaN(note) || note < 0 || note > 127) {
                        console.log(
                            `Invalid MIDI note number: ${noteStr}. Must be between 0 and 127.`
                        );
                    } else {
                        pitches.push(note);
                    }
                }
                if (pitches.length === 0) {
                    console.log(
                        'No valid pitches entered. Using default pitches.'
                    );
                    resolve(defaultPitches);
                    return;
                }
                resolve(pitches);
            }
        );
    });
};
