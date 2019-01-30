// Just making sure the logic is correct before having to reload stuff inside QON

const TagExtractor = require('../tag-extraction.js');
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const debug = process.argv.includes('--debug');

function makeAssertionFunctions(errors) {
    function assertArrayEquals(expected, given) {
        assertEquals(true, Array.isArray(expected), 'expected value is not an array');
        assertEquals(true, Array.isArray(given), 'given value is not an array');
        assertEquals(expected.length, given.length, `array length mismatch: ${expected.length} != ${given.length}`);
        for (let i = 0; i < expected.length; ++i) {
            const expectedQuote = typeof expected === 'string' ? '"' : '';
            const givenQuote = typeof given === 'string' ? '"' : '';
            const errorMessage = `element mismatch at index ${i}: ${expectedQuote}${expected}${expectedQuote} !== ${givenQuote}${given}${givenQuote}`;

            assertEquals(expected[i], given[i], errorMessage);
        }
    }

    function assertEquals(expected, given, errorMessage) {
        if (expected !== given) {
            if (!errorMessage) {
                const expectedQuote = typeof expected === 'string' ? '"' : '';
                const givenQuote = typeof given === 'string' ? '"' : '';
                errorMessage = `${expectedQuote}${expected}${expectedQuote} !== ${givenQuote}${given}${givenQuote}`;
            }
            errors.push(new Error(errorMessage));
        }
    }

    return {
        assertEquals,
        assertArrayEquals,
    }
}

function executeTests(directory) {
    const dir = fs.readdirSync(directory);

    let successCount = 0;
    let errorCount = 0;
    for (let i = 0; i < dir.length; ++i) {
        const name = dir[i];
        const target = directory + '/' + name;

        const stats = fs.statSync(target);
        if (stats.isFile()) {
            let content = fs.readFileSync(target, { encoding: 'utf-8' });
            if (executeTest(target, name, content)) {
                ++successCount;
            } else {
                ++errorCount;
            }
        } else if (stats.isDirectory()) {
            console.error('skipping directory', target);
        }
    }

    if (errorCount === 0) {
        console.log(`✓ ${successCount} tests passed \\o/`);
    }
    console.log('executed', successCount + errorCount, 'tests,', successCount, 'passed and', errorCount, 'failed');
}


function executeScriptWithVariables(filename, testName, script, variables) {
    let variableDeclarations = '';
    for (const [key, value] of Object.entries(variables)) {
        // FIXME Rewrite strings so that the instructions aren't multiline. This way, the stacktrace will point to the correct assertion
        variableDeclarations += `const ${key} = \`${value}\`;\n`;
    }

    // language=ECMAScript 6
    let s = `
const TagExtraction = require('../tag-extraction.js');
${variableDeclarations}
${script}
`;

    let newLines = variableDeclarations.match(/\n/g);
    let lineOffset = 0;
    if (newLines) {
        lineOffset = -newLines.length - 3
    }
    if (debug) {
        console.debug(`=== ${testName} ===`);
        console.debug(s);
        console.debug('========', lineOffset, '========');
    }
    let eval = new vm.Script(s, {
        filename: filename,
        lineOffset: lineOffset,
    });

    const errors = [];
    eval.runInNewContext({
        require,
        ...makeAssertionFunctions(errors),
        TagExtractor,
    });

    return errors;
}

function extractVariables(content, start) {
    const variables = {};


    let lineStart = start;
    let lineEnd;
    let variableName = '';
    while ((lineEnd = content.indexOf('\n', lineStart)) > 0) {
        const line = content.substring(lineStart, lineEnd + 1);
        if (line.startsWith('--- ') && line.endsWith(' ---\n')) {
            variableName = line.slice('--- '.length, -' ---\n'.length);
            variables[variableName] = '';
            lineStart = lineEnd + 1;
            continue;
        }

        variables[variableName] += line;
        lineStart = lineEnd + 1;
    }

    return variables;
}

function executeTest(filename, testName, content) {
    let script = '';
    let lineStart = 0;
    let lineEnd;
    while ((lineEnd = content.indexOf('\n', lineStart)) > 0) {
        const line = content.substring(lineStart, lineEnd + 1);
        if (line.startsWith('--- ')) {
            break;
        }

        script += line;
        lineStart = lineEnd + 1;
    }

    let variables = extractVariables(content, lineStart);

    let errors = executeScriptWithVariables(filename, testName, script, variables);
    printTestErrors(testName, errors);

    return errors.length === 0;
}


function printTestErrors(testName, errors) {
    if (errors.length !== 0) {
        console.error(`X ${testName} failed with ${errors.length} assertion errors`);
        console.error(errors);
    } else {
        console.log(`✓ ${testName} passed`);
    }
}

executeTests(path.resolve('./test_cases'));
