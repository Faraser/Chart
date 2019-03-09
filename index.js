const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

const canvas2 = document.getElementById('canvas2')
const ctx2 = canvas2.getContext('2d');

const win = document.getElementById('win');

console.log(points)

let startX = 0;
let currentTransform = 0;
let transform = 0;
let winWidth = win.clientWidth;
win.addEventListener('touchstart', e => {
    startX = e.changedTouches[0].clientX;
});

win.addEventListener('touchmove', e => {
    let x = e.changedTouches[0].clientX;
    const diffX = x - startX;
    transform = Math.max(0, currentTransform + diffX);
    transform = Math.min(transform, canvas.width / 2 - winWidth);

    console.log(transform, diffX);
    win.style.transform = `translateX(${transform}px)`
});

win.addEventListener('touchend', e => {
    currentTransform = transform;
});

let i = 0;
let j = 50;

render();

const values = points.map(x => x[1]);
const maxValue = Math.max.apply(null, values);
const minValue = Math.min.apply(null, values);

const diffValue = maxValue - minValue;
drawPlot(ctx2, points, maxValue, diffValue);

function render() {
    // j = (j + 0.5) % points.length;
    const visiblePoints = points.slice(0, j);

    const values = visiblePoints.map(x => x[1]);

    const maxValue = Math.max.apply(null, values);
    const minValue = Math.min.apply(null, values);

    const diffValue = maxValue - minValue;
    // console.log(maxValue, minValue, diffValue)

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    drawYAxis(values);
    drawPlot(ctx, visiblePoints, maxValue, diffValue);
    requestAnimationFrame(render)
}

function drawYAxis(values) {
    const axis = calcYAxes(values);
    // console.log(axis)

    ctx.lineWidth = 1;
    const step = canvas.height / axis.steps;
    for (let i = 0; i < axis.steps; i++) {
        const yCoord = step * i;
        ctx.beginPath();
        ctx.moveTo(0, yCoord);
        ctx.lineTo(canvas.width, yCoord);
        ctx.stroke();
    }
}

function drawPlot(ctx, points, maxValue, diffValue) {
    // i += 0.02;
    const canvas = ctx.canvas;
    const verticalScale = 100 * (Math.sin(i) + 1) / 2;

    const horizontalStep = canvas.width / (points.length - 1);
    const maxHeight = canvas.height - verticalScale;
    const verticalOffset = (canvas.height - maxHeight) / 2;

    ctx.beginPath();
    ctx.lineWidth = 4;
    ctx.moveTo(0, 0);
    ctx.strokeStyle = '#8f7fff';
    points.forEach((point, i) => {
        const yCoord = ((maxValue - point[1]) / diffValue) * maxHeight + verticalOffset;
        const xCoord = i * horizontalStep;
        // console.log(xCoord, yCoord, (maxValue - point[1]) / diffValue)
        ctx.lineTo(xCoord, yCoord);
    });
    ctx.stroke();
}

function calcYAxes(valuesArray) {
    var calculateOrderOfMagnitude = function(val) {
            return Math.floor(Math.log(val) / Math.LN10);
        },
        maxSteps = 5,
        maxValue = Math.max.apply(Math, valuesArray),
        minValue = Math.min.apply(Math, valuesArray),

        valueRange = Math.abs(maxValue - minValue),
        rangeOrderOfMagnitude = calculateOrderOfMagnitude(valueRange),

        // eslint-disable-next-line max-len
        graphMax = Math.ceil(maxValue / (Math.pow(10, rangeOrderOfMagnitude))) * Math.pow(10, rangeOrderOfMagnitude),
        // eslint-disable-next-line max-len
        graphMin = Math.floor(minValue / (Math.pow(10, rangeOrderOfMagnitude))) * Math.pow(10, rangeOrderOfMagnitude),
        graphRange = graphMax - graphMin,
        stepValue = Math.pow(10, rangeOrderOfMagnitude),
        numberOfSteps = Math.round(graphRange / stepValue);

    // Подбираем оптимальную величину шага
    while ((numberOfSteps > maxSteps || (numberOfSteps * 2) < maxSteps)) {
        if (numberOfSteps > maxSteps) {
            stepValue *= 2;
            numberOfSteps = Math.round(graphRange / stepValue);
        } else {
            stepValue /= 2;
            numberOfSteps = Math.round(graphRange / stepValue);
        }
    }

    // Если величина шага недостаточна, то увеличиваем кол-во шагов
    while (graphMin + (numberOfSteps * stepValue) < graphMax) {
        numberOfSteps++;
    }

    return {
        steps: numberOfSteps,
        stepValue: stepValue,
        min: graphMin,
        max: graphMin + (numberOfSteps * stepValue)
    };
}
