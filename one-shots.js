function generateNotesForOctaves(_notes = [0, 2, 4, 7, 9]) {
    const notes = [];
    for (let octave = 2; octave <= 7; octave++) {
        const baseNote = octave * 12; // MIDI note number for C at the given octave
        _notes.forEach((note) => {
            notes.push(baseNote + note);
        });
    }
    return notes;
}

// TODO: make this one more customizable when triggered from the command line
export function playBirdFlockAscendingSequence(
    baseNotes,
    midiOutput,
    midiOutputChannel
) {
    const notes = generateNotesForOctaves(baseNotes);
    const startTime = Date.now();
    const totalDuration = 30000; // Total sequence duration in milliseconds
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
        const noteWeights = notes.map((note) => {
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
                selectedNote = notes[i];
                break;
            }
        }

        // Random note duration between 20 and 100 ms
        const noteDuration = 20 + Math.random() * 80;

        // Send MIDI Note On message
        // sendMidiNoteOn(selectedNote);
        // TODO: make velocity vary
        midiOutput.sendMessage([
            0x90 + midiOutputChannel - 1,
            selectedNote,
            20 + Math.floor(Math.random() * 80),
        ]);

        // Schedule MIDI Note Off message after the note duration
        setTimeout(() => {
            // sendMidiNoteOff(selectedNote);
            midiOutput.sendMessage([
                0x80 + midiOutputChannel - 1,
                selectedNote,
                0,
            ]);
        }, noteDuration);

        // Random delay before the next note (optional)
        const delayBetweenNotes = Math.random() * 100;

        // Schedule the next note
        setTimeout(playNextNote, noteDuration + delayBetweenNotes);
    }

    playNextNote();
}
