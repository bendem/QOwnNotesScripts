import QtQml 2.0
import QOwnNotesTypes 1.0

import './tag-extraction.js' as X;

/**
 * This script handles tagging in a note for tags in the note text like:
 * @tag1 @tag2 @tag3
 * @tag_one would tag the note with "tag one" tag.
 */

Script {
    property string tagMarker
    property bool putToBeginning
    property string tagHighlightColor

    property variant settingsVariables: [
        {
            "identifier": "tagMarker",
            "name": "Tag word marker",
            "description": "A word that starts with this characters is recognized as tag",
            "type": "string",
            "default": "@",
        },
        {
            "identifier": "putToBeginning",
            "name": "Put tags to beginning of note rather than to end",
            "description": "If enabled tags, added by UI, will be put to the first line of note or right after top headline",
            "type": "boolean",
            "default": "false",
        },
        {
            "identifier": "tagHighlightColor",
            "name": "The color for tag highlighting in note preview",
            "description": "Put a <a href=\"https://www.w3.org/TR/SVG/types.html#ColorKeywords\">color name</a> or a <a href=\"http://doc.qt.io/qt-5/qcolor.html#setNamedColor\">supported</a> color code here. Leave empty to disable tag highlighting in preview.",
            "type": "string",
            "default": "purple",
        },
    ]

    /**
     * Handles note tagging for a note
     *
     * This function is called when tags are added to, removed from or renamed in
     * a note or the tags of a note should be listed
     *
     * @param note
     * @param action can be "add", "remove", "rename" or "list"
     * @param tagName tag name to be added, removed or renamed
     * @param newTagName tag name to be renamed to if action = "rename"
     * @return string or string-list (if action = "list")
     */
    function noteTaggingHook(note, action, tagName, newTagName) {
        // FIXME Needs something to sanitize tags that have invalid characters (in 'add' and 'rename' mode, maybe 'remove' as well?)

        const noteText = note.noteText;
        const tagExtractor = new X.TagExtractor(putToBeginning, tagMarker);

        switch (action) {
            // adds the tag "tagName" to the note
            // the new note text has to be returned so that the note can be updated
            // returning an empty string indicates that nothing has to be changed
            case "add": {
                const tagToAdd = tagMarker + tagName;
                const bounds = tagExtractor.findTagLineBounds(noteText);
                if (bounds === null) {
                    if (putToBeginning) {
                        return tagExtractor.insertTagLineAfterTitle(noteText, tagToAdd);
                    } else {
                        return noteText + '\n\n' + tagToAdd + '\n'
                    }
                }

                const tagLine = tagExtractor.findTagLineFromBounds(bounds);
                const tags = tagExtractor.tagLineToTags(tagLine);

                if (tags.includes(tagToAdd)) {
                    return '';
                }

                tags.push(tagToAdd);

                return tagExtractor.replaceTextInBoundsWith(noteText, bounds, TagExtraction.tagsToTagLine(tags))
            }

            // removes the tag "tagName" from the note
            // the new note text has to be returned so that the note can be updated
            // returning an empty string indicates that nothing has to be changed
            case "remove": {
                const newText = tagExtractor.removeTagInNote(noteText, tagName);
                if (newText === null) {
                    return '';
                }
                return newText;
            }

            // renames the tag "tagName" in the note to "newTagName"
            // the new note text has to be returned so that the note can be updated
            // returning an empty string indicates that nothing has to be changed
            case "rename": {
                const newText = tagExtractor.renameTagInNote(noteText, tagName, newTagName);
                if (newText === null) {
                    return '';
                }
                return newText;
            }

            // returns a list of all tag names of the note
            case "list": {
                const tagLine = tagExtractor.findTagLine(noteText);
                if (tagLine === null) {
                    return [];
                }
                console.log(tagExtractor.tagLineToTags(tagLine));
                return tagExtractor.tagLineToTags(tagLine);
            }
        }

        return "";
    }

    // FIXME Does this need to be added back? Can we do it without parsing the whole thing with a regex?
    // Removes tag marker in note preview and highlights tag name with set color
    function noteToMarkdownHtmlHook(note, html) {
        if (tagHighlightColor === "") {
            return;
        }

        const noteText = note.noteText;
        const tagExtractor = new X.TagExtractor(putToBeginning, tagMarker);
        const tagLine = tagExtractor.findTagLine(noteText);

        return html.replace(`<p>${tagLine}</p>`, `<p style="color: ${tagHighlightColor};">${tagLine}</p>`);
    }

    /**
     * Hook to feed the autocompletion with tags if the current word starts with the tag marker
     */
    function autocompletionHook() {
        //
        // FIXME Autocompletion is kind of borked, it doesn't append the missing part of the word, but appends the whole word.
        //       so if you type '@some' and autocomplete with 'something', you get '@somesomething'.
        //

        // get the current word plus non-word-characters before the word to also get the tag marker
        const word = script.noteTextEditCurrentWord(true);

        if (!word.startsWith(tagMarker)) {
            return [];
        }

        // cut the tag marker off of the string and do a substring search for tags
        var tags = script.searchTagsByName(word.substring(tagMarker.length));

        // convert tag names with spaces to in-text tags with "_", "tag one" to @tag_one
        for (var i = 0; i < tags.length; i++) {
            tags[i] = tags[i].replace(/ /g, "_");
        }

        return tags;
    }
}
