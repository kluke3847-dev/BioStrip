export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({
            error: 'POST 요청만 허용됩니다.'
        });
    }

    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
        return res.status(500).json({
            error: 'Vercel에 OPENAI_API_KEY 환경변수가 등록되지 않았습니다.'
        });
    }

    try {
        const body = req.body || {};

        const action =
            typeof body.action === 'string'
                ? body.action
                : 'report';

        const question =
            typeof body.question === 'string'
                ? body.question.slice(0, 1500)
                : '';

        const suppliedContext =
            body.context && typeof body.context === 'object'
                ? body.context
                : null;

        const analysis =
            body.analysis || suppliedContext?.analysis || {};

        const calibration =
            Array.isArray(body.calibration)
                ? body.calibration
                : Array.isArray(suppliedContext?.calibration)
                    ? suppliedContext.calibration
                    : [];

        const history =
            Array.isArray(body.history)
                ? body.history
                : Array.isArray(suppliedContext?.history)
                    ? suppliedContext.history
                    : [];

        const hasAnalysis =
            analysis &&
            typeof analysis === 'object' &&
            Object.keys(analysis).length > 0;

        const hasCalibration =
            Array.isArray(calibration) && calibration.length > 0;

        if (!hasAnalysis) {
            return res.status(400).json({
                error: '현재 분석 결과가 없습니다. 먼저 pH 분석을 실행해 주세요.'
            });
        }

        const instructions = `
