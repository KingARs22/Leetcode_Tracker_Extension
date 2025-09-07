// src/lib/complexity.js
window.estimateComplexity = function (code) {
    // Very basic placeholder example
    const lines = code.split('\n').length;
    const loops = (code.match(/for|while/g) || []).length;
    const time = loops > 2 ? 'O(n^2?)' : 'O(n)';
    const space = lines > 50 ? 'O(n)' : 'O(1)';
    const hints = [];
    if (loops > 2) hints.push('Nested loops detected');
    if (lines > 50) hints.push('Large function');
    return { time, space, hints };
};
