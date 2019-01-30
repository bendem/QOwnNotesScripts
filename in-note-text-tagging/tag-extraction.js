const INVALID_CHARS_FOR_TAGS = ['`', '[', ']', '(', ')'];

function TagExtractor(tagAtBegginingOfNote, tagMarker) {
    this.tagAtBegginingOfNote = tagAtBegginingOfNote;
    this.tagMarker = tagMarker;
}

TagExtractor.prototype.findTagLineBounds = function(noteText) {
    const whiteSpaceChars = [' ', '\n', '\r', '\t'];
    const noteLength = noteText.length;
    const self = this;

    function findFirst_At_SkippingBlankLines(noteText, startIndex) {
        for (let i = startIndex; i < noteLength; ++i) {
            if (noteText[i - 1] === '\n' && noteText[i] === self.tagMarker) {
                return i;
            }
            if (whiteSpaceChars.includes(noteText[i])) {
                continue;
            }
            return null;
        }
    }

    function validateLineOnlyHasTags(noteText, start, end) {
        // validate that we didn't actually get a line of text that starts with the tagMarker
        for (let i = start + 1; i < end; ++i) {
            if (whiteSpaceChars.includes(noteText[i - 1])
                    && !whiteSpaceChars.includes(noteText[i])
                    && noteText[i] !== self.tagMarker) {
                return false;
            }
        }
        return true;
    }

    let start = null;
    if (this.tagAtBegginingOfNote) {
        // look for a line of tags between the title and the content of the note

        if (noteText.startsWith('# ')) {
            start = findFirst_At_SkippingBlankLines(noteText, noteText.indexOf('\n') + 1);
        } else {
            const secondLine = noteText.indexOf('\n') + 1;
            if (noteText[secondLine] !== '=') {
                // no title, it could probably be handled better, but meh
                return null;
            }

            start = findFirst_At_SkippingBlankLines(noteText, noteText.indexOf('\n', secondLine) + 1);
        }

        if (start === null) {
            return null;
        }

        let end = noteText.indexOf('\n', start + 1);
        if (end === -1) {
            // no newline at eof
            end = noteLength;
        }

        if (!validateLineOnlyHasTags(noteText, start, end)) {
            return null;
        }

        return {
            start,
            end,
        };
    } else {
        const lastTagStart = noteText.lastIndexOf(this.tagMarker);
        if (lastTagStart < 0) {
            return null;
        }

        let end = noteText.indexOf('\n', lastTagStart + 1);
        if (end < 0) {
            // no newline at EOF
            end = noteLength;
        }

        // make sure there is no non-empty lines after the one we are inspecting
        for (let i = end; i < noteLength; i++) {
            if (!whiteSpaceChars.includes(noteText[i])) {
                // last tagMarker was not found on the last line, there is no tag line
                return null;
            }
        }

        // inspect the start of the line
        for (let i = lastTagStart - 1; i > 0; --i) {
            if (INVALID_CHARS_FOR_TAGS.includes(noteText[i])) {
                // last line containing tagMarker also contains markup, not a tag line.
                return null;
            }

            if (noteText[i] === '\n') {
                start = i + 1;
                break;
            }
        }

        if (!validateLineOnlyHasTags(noteText, start, end)) {
            return null;
        }

        return {
            start, end,
        };
    }
};

TagExtractor.prototype.renameTagInNote = function(noteText, oldTag, newTag) {
    const bounds = this.findTagLineBounds(noteText);
    if (bounds === null) {
        return null;
    }
    const tagLine = this.findTagLineFromBounds(noteText, bounds);
    const tags = this.tagLineToTags(tagLine);
    const index = tags.indexOf(oldTag);
    if (index < 0) {
        return null;
    }
    tags.splice(index, 1, newTag);
    const newTagLine = this.tagsToTagLine(tags);
    return this.replaceTextInBoundsWith(noteText, bounds, newTagLine);
};

TagExtractor.prototype.removeTagInNote = function(noteText, tagName) {
    const bounds = this.findTagLineBounds(noteText);
    if (bounds === null) {
        return null;
    }
    const tagLine = this.findTagLineFromBounds(noteText, bounds);
    const tags = this.tagLineToTags(tagLine);
    const index = tags.indexOf(tagName);
    if (index < 0) {
        return null;
    }
    tags.splice(index, 1);
    let newTagLine = this.tagsToTagLine(tags);
    return this.replaceTextInBoundsWith(noteText, bounds, newTagLine);
};

TagExtractor.prototype.findTagLineFromBounds = function(noteText, bounds) {
    return noteText.substring(bounds.start, bounds.end);
};

TagExtractor.prototype.findTagLine = function(noteText) {
    const bounds = this.findTagLineBounds(noteText);
    if (bounds === null) {
        return null;
    }
    return this.findTagLineFromBounds(noteText, bounds);
};

TagExtractor.prototype.tagLineToTags = function(tagLine) {
    return tagLine
        .trim()
        .split(/\s+/)
        .filter(tag => tag.startsWith(this.tagMarker))
        .filter(function(elem, index, self) {
            return index === self.indexOf(elem);
        })
        .map(tag => tag.substring(this.tagMarker.length));
};

TagExtractor.prototype.tagsToTagLine = function(tags) {
    let tagLine = '';
    let first = true;
    for (const tag of tags) {
        if (first) {
            first = false;
        } else {
            tagLine += ' ';
        }
        tagLine += this.tagMarker + tag;
    }
    return tagLine;
};

TagExtractor.prototype.replaceTextInBoundsWith = function(noteText, bounds, newContent) {
    return noteText.substring(0, bounds.start) + newContent + noteText.substring(bounds.end, noteText.length);
};

TagExtractor.prototype.insertTagLineAfterTitle = function(noteText, tagToAdd) {
    // FIXME no tag line yet, gotta find where to insert the tag, that's the hard part
    return '';
};

if (typeof module !== 'undefined') {
    module.exports = TagExtractor;
}
