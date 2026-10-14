import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { registerHooks } from 'node:module';
import assert from 'node:assert/strict';
import ts from 'typescript';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const viewerRoot = path.resolve(__dirname, '..');

// Provide a clean in-memory localStorage & window environment for tests
class MemoryStorage {
    constructor() {
        this.map = new Map();
    }
    getItem(key) {
        return this.map.has(key) ? this.map.get(key) : null;
    }
    setItem(key, value) {
        this.map.set(String(key), String(value));
    }
    removeItem(key) {
        this.map.delete(key);
    }
    clear() {
        this.map.clear();
    }
}

const localStorageInstance = new MemoryStorage();
const windowListeners = new Map();

globalThis.localStorage = localStorageInstance;
globalThis.window = {
    localStorage: localStorageInstance,
    innerWidth: 1280,
    innerHeight: 800,
    addEventListener(type, fn) {
        if (!windowListeners.has(type)) windowListeners.set(type, new Set());
        windowListeners.get(type).add(fn);
    },
    removeEventListener(type, fn) {
        windowListeners.get(type)?.delete(fn);
    },
    dispatchEvent(event) {
        const set = windowListeners.get(event.type);
        if (set) {
            for (const fn of set) fn(event);
        }
    }
};

// Register TypeScript + JSX synchronous loader hooks
registerHooks({
    resolve(specifier, context, nextResolve) {
        if (specifier.startsWith('.') && context.parentURL) {
            const parentPath = fileURLToPath(context.parentURL);
            const baseDir = path.dirname(parentPath);
            const candidateBase = path.resolve(baseDir, specifier);
            const exts = ['', '.ts', '.tsx', '.js', '.jsx'];
            for (const ext of exts) {
                const full = candidateBase + ext;
                if (fs.existsSync(full) && fs.statSync(full).isFile()) {
                    return {
                        url: pathToFileURL(full).href,
                        shortCircuit: true
                    };
                }
            }
        }
        return nextResolve(specifier, context);
    },
    load(url, context, nextLoad) {
        if (url.endsWith('.ts') || url.endsWith('.tsx')) {
            const filePath = fileURLToPath(url);
            const source = fs.readFileSync(filePath, 'utf8');
            const transpiled = ts.transpileModule(source, {
                fileName: filePath,
                compilerOptions: {
                    target: ts.ScriptTarget.ES2022,
                    module: ts.ModuleKind.ESNext,
                    moduleResolution: ts.ModuleResolutionKind.Bundler,
                    jsx: ts.JsxEmit.ReactJSX,
                    esModuleInterop: true
                }
            });
            return {
                format: 'module',
                source: transpiled.outputText,
                shortCircuit: true
            };
        }
        return nextLoad(url, context);
    }
});

// Minimal test harness (Vitest-compatible describe/it/expect)
const suites = [];
let currentSuite = null;

globalThis.describe = (name, fn) => {
    const prev = currentSuite;
    const suite = { name, tests: [], beforeEachFns: [] };
    currentSuite = suite;
    fn();
    currentSuite = prev;
    suites.push(suite);
};

globalThis.beforeEach = (fn) => {
    if (currentSuite) {
        currentSuite.beforeEachFns.push(fn);
    }
};

globalThis.it = globalThis.test = (name, fn) => {
    if (currentSuite) {
        currentSuite.tests.push({ name, fn });
    } else {
        suites.push({ name: 'default', tests: [{ name, fn }], beforeEachFns: [] });
    }
};

globalThis.expect = (actual) => ({
    toBe(expected) {
        assert.strictEqual(actual, expected);
    },
    toEqual(expected) {
        assert.deepStrictEqual(actual, expected);
    },
    toBeTruthy() {
        assert.ok(actual);
    },
    toBeFalsy() {
        assert.ok(!actual);
    },
    toContain(sub) {
        if (typeof actual === 'string' || Array.isArray(actual)) {
            assert.ok(
                actual.includes(sub),
                `Expected ${JSON.stringify(actual)} to contain ${JSON.stringify(sub)}`
            );
        } else {
            assert.fail(`toContain called on unsupported value: ${actual}`);
        }
    },
    toBeGreaterThan(num) {
        assert.ok(actual > num, `Expected ${actual} > ${num}`);
    },
    toBeGreaterThanOrEqual(num) {
        assert.ok(actual >= num, `Expected ${actual} >= ${num}`);
    },
    toBeLessThanOrEqual(num) {
        assert.ok(actual <= num, `Expected ${actual} <= ${num}`);
    },
    toHaveLength(len) {
        assert.strictEqual(actual?.length, len);
    },
    not: {
        toBe(expected) {
            assert.notStrictEqual(actual, expected);
        },
        toContain(sub) {
            assert.ok(
                !actual.includes(sub),
                `Expected ${JSON.stringify(actual)} NOT to contain ${JSON.stringify(sub)}`
            );
        }
    }
});

function findTestFiles(dir) {
    const results = [];
    if (!fs.existsSync(dir)) return results;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            results.push(...findTestFiles(full));
        } else if (/\.test\.(ts|tsx)$/.test(entry.name)) {
            results.push(full);
        }
    }
    return results;
}

const args = process.argv.slice(2).filter((arg) => arg !== '--run' && arg !== '--');
const allTestFiles = findTestFiles(path.join(viewerRoot, 'src'));

const selectedFiles =
    args.length > 0
        ? allTestFiles.filter((file) => {
              const normFile = file.replace(/\\/g, '/');
              return args.some((pattern) => {
                  const normPattern = pattern.replace(/\\/g, '/');
                  return normFile.endsWith(normPattern) || normFile.includes(normPattern);
              });
          })
        : allTestFiles;

if (selectedFiles.length === 0) {
    console.error('No matching test files found.');
    process.exit(1);
}

let passed = 0;
let failed = 0;

for (const file of selectedFiles) {
    suites.length = 0;
    await import(pathToFileURL(file).href);
    const relName = path.relative(viewerRoot, file).replace(/\\/g, '/');
    console.log(`\nRUN  ${relName}`);
    for (const suite of suites) {
        for (const t of suite.tests) {
            try {
                localStorageInstance.clear();
                windowListeners.clear();
                for (const hook of suite.beforeEachFns) {
                    await hook();
                }
                await t.fn();
                passed++;
                console.log(`  ✓ ${suite.name} > ${t.name}`);
            } catch (err) {
                failed++;
                console.error(`  ✗ ${suite.name} > ${t.name}`);
                console.error(`    ${err?.stack || err}`);
            }
        }
    }
}

console.log(`\nTest Files: ${selectedFiles.length} executed`);
console.log(`Tests:      ${passed} passed, ${failed} failed\n`);

if (failed > 0) {
    process.exit(1);
}
