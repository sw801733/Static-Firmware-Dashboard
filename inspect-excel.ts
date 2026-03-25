// Test the parser against real Excel files
import * as fs from 'fs';
import * as path from 'path';

// We need to simulate the File API for Node.js
class FakeFile {
    name: string;
    private buffer: Buffer;

    constructor(filePath: string) {
        this.name = path.basename(filePath);
        this.buffer = fs.readFileSync(filePath);
    }

    async arrayBuffer(): Promise<ArrayBuffer> {
        return this.buffer.buffer.slice(
            this.buffer.byteOffset,
            this.buffer.byteOffset + this.buffer.byteLength
        );
    }
}

async function main() {
    // Dynamically import the parser
    const { parseProjectSummary, parseReference } = await import('./src/services/excelParser.ts');

    console.log('=== Testing Project Summary Report ===\n');
    const report = await parseProjectSummary(
        new FakeFile('./data/Project Summary Report.xlsx') as any
    );

    console.log('Summary:', JSON.stringify(report.summary, null, 2));
    console.log('\nRuleset Name:', report.rulesetName);
    console.log('Ruleset Summary:', JSON.stringify(report.rulesetSummary, null, 2));
    console.log(`\nRules: ${report.rules.length} total`);
    report.rules.slice(0, 5).forEach(r =>
        console.log(`  ${r.rule}: remaining=${r.remaining}, suppressed=${r.suppressed}`)
    );
    if (report.rules.length > 5) console.log(`  ... (${report.rules.length - 5} more)`);

    console.log(`\nFiles: ${report.files.length} total`);
    report.files.slice(0, 5).forEach(f =>
        console.log(`  ${f.file}: rules=${f.ruleCount}, remaining=${f.remaining}, suppressed=${f.suppressed}`)
    );

    console.log('\n\n=== Testing Reference File ===\n');
    const refs = await parseReference(
        new FakeFile('./data/MISRA_C_2023_위배 유형 분류.xlsx') as any
    );

    console.log(`References: ${refs.length} total`);
    refs.slice(0, 5).forEach(r =>
        console.log(`  ${r.ruleNameOriginal} (${r.ruleName}): [${r.classification}] ${r.justification.substring(0, 60)}...`)
    );
    if (refs.length > 5) console.log(`  ... (${refs.length - 5} more)`);
}

main().catch(console.error);
