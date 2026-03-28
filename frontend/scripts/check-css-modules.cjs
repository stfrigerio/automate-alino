#!/usr/bin/env node

/**
 * CSS Module Quality Checker
 * Enforces two rules:
 * 1. Each component can ONLY import its own CSS module (1:1 mapping)
 * 2. All CSS classes must be used in their matching component (no unused classes)
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// ============================================================================
// Rule 1: Check CSS Import 1:1 Mapping
// ============================================================================

function findAllComponentFiles() {
    const result = execSync('find src -name "*.tsx" -o -name "*.ts"', { encoding: 'utf-8' });
    return result.trim().split('\n').filter(Boolean);
}

function extractCSSImport(file) {
    try {
        const content = fs.readFileSync(file, 'utf-8');
        const importRegex = /import\s+\w+\s+from\s+['"](.+\.module\.css)['"]/g;
        const matches = [];
        let match;

        while ((match = importRegex.exec(content)) !== null) {
            matches.push(match[1]);
        }

        return matches;
    } catch (e) {
        return [];
    }
}

function getExpectedCSSFileName(componentFile) {
    const baseName = path.basename(componentFile, path.extname(componentFile));
    return `${baseName}.module.css`;
}

function checkImportRules() {
    const componentFiles = findAllComponentFiles();
    const violations = [];

    for (const file of componentFiles) {
        const cssImports = extractCSSImport(file);

        if (cssImports.length === 0) {
            continue;
        }

        const baseName = path.basename(file, path.extname(file));
        const expectedCSSFile = getExpectedCSSFileName(file);
        const componentDir = path.dirname(file);

        for (const importPath of cssImports) {
            const resolvedPath = path.resolve(componentDir, importPath);
            const importedFileName = path.basename(resolvedPath);

            // Allow imports that match the component name (with optional suffix like .mobile)
            // e.g., Navbar.tsx can import Navbar.module.css or Navbar.mobile.module.css
            const isValidImport =
                importedFileName === expectedCSSFile ||
                importedFileName.startsWith(`${baseName}.`) && importedFileName.endsWith('.module.css');

            if (!isValidImport) {
                violations.push({
                    file: file,
                    imported: importPath,
                    expected: expectedCSSFile
                });
            }
        }
    }

    return violations;
}

// ============================================================================
// Rule 2: Check for Unused CSS Classes
// ============================================================================

function findCSSModules(dir) {
    const result = execSync(`find ${dir} -name "*.module.css"`, { encoding: 'utf-8' });
    return result.trim().split('\n').filter(Boolean);
}

function findComponentFiles(cssFile) {
    const dir = path.dirname(cssFile);
    try {
        const files = fs.readdirSync(dir);
        return files
            .filter(f => /\.(tsx?|jsx?)$/.test(f))
            .map(f => path.join(dir, f));
    } catch (e) {
        return [];
    }
}

function extractClasses(cssContent) {
    const classRegex = /\.([a-zA-Z][a-zA-Z0-9_-]*)\s*\{/g;
    const classes = [];
    let match;

    while ((match = classRegex.exec(cssContent)) !== null) {
        classes.push(match[1]);
    }

    return [...new Set(classes)];
}

function isClassUsed(className, componentFiles) {
    for (const file of componentFiles) {
        try {
            const content = fs.readFileSync(file, 'utf-8');
            const patterns = [
                `styles.${className}`,
                `styles['${className}']`,
                `styles["${className}"]`,
                `styles\`${className}\``,
            ];

            if (patterns.some(pattern => content.includes(pattern))) {
                return true;
            }

            // Check for dynamic bracket access like styles[someVariable]
            if (/styles\[[^\]]*\]/.test(content)) {
                const dynamicPattern = new RegExp(`['"\`]${className}['"\`]`);
                if (dynamicPattern.test(content)) {
                    return true;
                }
            }

            // Check for template literal dynamic access like styles[`size-${size}`]
            // This handles patterns like: size-sm, size-md, size-lg when code has styles[`size-${size}`]
            const hyphenMatch = className.match(/^([a-zA-Z]+)-([a-zA-Z]+)$/);
            if (hyphenMatch) {
                const prefix = hyphenMatch[1];
                // Check if there's a template literal that could generate this class
                const templatePattern = new RegExp(`styles\\[\`${prefix}-\\$\\{[^}]+\\}\`\\]`);
                if (templatePattern.test(content)) {
                    return true;
                }
            }
        } catch (e) {
            return true;
        }
    }
    return false;
}

function checkUnusedClasses() {
    const srcDir = path.join(__dirname, '..', 'src');
    const cssFiles = findCSSModules(srcDir);
    const violations = [];

    for (const cssFile of cssFiles) {
        const componentFiles = findComponentFiles(cssFile);

        if (componentFiles.length === 0) {
            continue;
        }

        const cssContent = fs.readFileSync(cssFile, 'utf-8');
        const classes = extractClasses(cssContent);
        const unusedClasses = [];

        for (const className of classes) {
            if (!isClassUsed(className, componentFiles)) {
                unusedClasses.push(className);
            }
        }

        if (unusedClasses.length > 0) {
            violations.push({
                file: cssFile,
                unused: unusedClasses
            });
        }
    }

    return violations;
}

// ============================================================================
// Main
// ============================================================================

function main() {
    console.log('\n========================================');
    console.log('[CHECK] Starting CSS module validation');
    console.log('========================================\n');

    // Check Rule 1: Import violations
    console.log('[1/2] Checking CSS import 1:1 mapping...');
    const importViolations = checkImportRules();

    if (importViolations.length > 0) {
        console.log('[FAIL] Found CSS import violations:\n');
        for (const violation of importViolations) {
            console.log(`File: ${violation.file}`);
            console.log(`  [X] Imports: ${violation.imported}`);
            console.log(`  [!] Should import: ${violation.expected}`);
            console.log();
        }
    } else {
        console.log('[PASS] All imports follow the 1:1 rule');
    }

    // Check Rule 2: Unused classes
    console.log('\n[2/2] Checking for unused CSS classes...');
    const unusedViolations = checkUnusedClasses();

    if (unusedViolations.length > 0) {
        const totalUnused = unusedViolations.reduce((sum, v) => sum + v.unused.length, 0);
        console.log('[FAIL] Found unused CSS classes:\n');
        for (const violation of unusedViolations) {
            console.log(`File: ${violation.file}`);
            console.log(`  Unused: ${violation.unused.join(', ')}`);
            console.log();
        }
        console.log(`Total: ${totalUnused} unused classes in ${unusedViolations.length} files`);
    } else {
        console.log('[PASS] No unused CSS classes');
    }

    // Summary
    const totalViolations = importViolations.length + unusedViolations.length;

    if (totalViolations === 0) {
        console.log('\n========================================');
        console.log('[PASS] All CSS module checks passed');
        console.log('========================================');
        console.log('[CHECK] CSS module validation completed');
        console.log('========================================\n');
        process.exit(0);
    } else {
        console.log('\n========================================');
        console.log('[FAIL] CSS module validation failed');
        console.log('========================================');
        console.log('\nRules:');
        console.log('1. Each component can ONLY import its own CSS module');
        console.log('   Example: Button.tsx -> Button.module.css');
        console.log('2. All CSS classes must be used in their matching component');
        console.log('   Remove unused classes to keep CSS clean');
        console.log('========================================');
        console.log('[CHECK] CSS module validation completed');
        console.log('========================================\n');
        process.exit(1);
    }
}

main();
