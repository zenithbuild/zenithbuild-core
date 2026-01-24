const native = require('./native/compiler-native');

console.log("Starting native compilation...");

const testCases = [
    { id: "simple_jsx", code: "<div>Hello</div>" },
    { id: "state_rename", code: "<div>{count}</div>" },
    { id: "nested_jsx", code: "<div><span>{count}</span></div>" },
    { id: "local_map", code: "items.map(item => <div>{item}</div>)" },
    { id: "mixed_scope", code: "items.map(item => <div>{item} + {count}</div>)" },
    { id: "attributes", code: "<div class='foo' data-count={count}>{label}</div>" }
];

const input = {
    filePath: "test.zen",
    scriptContent: "state count = 0; state items = []; state label = 'Zenith';",
    expressions: testCases,
    templateBindings: [],
    styles: [],
    nodes: []
};

try {
    const result = native.generateRuntimeCode(JSON.stringify(input));
    console.log("SUCCESS!");
    console.log("Generated Expressions:\n", result.expressions);
} catch (e) {
    console.error("FAILURE!");
    console.error(e);
}
