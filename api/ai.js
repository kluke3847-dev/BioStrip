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
당신은 BioStrip의 실험 분석 보조 AI입니다.

핵심 규칙:
1. pH 숫자를 새로 계산하거나 임의로 수정하지 마십시오.
2. BioStrip이 계산한 pH와 측정값을 그대로 사용하십시오.
3. 제공된 데이터에 없는 수치나 실험 결과를 만들어내지 마십시오.
4. 이미지 품질, 조명, calibration 범위, 반복 측정, 실험 오차를 설명하십시오.
5. 의료적 진단이나 치료 권고를 하지 마십시오.
6. 다음 실험 행동을 묻는 경우 안전하고 일반적인 데이터 측정·검증 절차만 제안하십시오.
7. 한국어로 답하십시오.
8. 불확실한 내용은 불확실하다고 명시하십시오.
9. 학생이 이해하기 쉬운 수준으로 설명하십시오.
`;

        let task = '';

        if (action === 'report') {
            task = `현재 BioStrip 분석 결과를 해석하십시오.
다음 순서로 작성하십시오:
[결과 요약]
[촬영/데이터 품질]
[Calibration 상태]
[주의할 점]
[권장 다음 단계]`;
        } else if (action === 'coach') {
            task = `현재 분석과 최근 기록을 보고 다음 실험에서 무엇을 확인하면 좋을지 제안하십시오.
측정값 자체를 바꾸지 말고 반복 측정, 촬영 조건, Calibration 검증 관점에서 제안하십시오.`;
        } else if (action === 'calibration') {
            task = `현재 Calibration 데이터를 점검하십시오.
데이터 수, pH 범위, 단조성, 제공된 검증 지표가 있다면 그 의미를 설명하고 추가로 측정하면 좋을 부분을 제안하십시오.`;
        } else if (action === 'quality') {
            task = `현재 이미지 품질과 조명 관련 지표를 해석하십시오.
왜 재촬영이 필요하거나 필요하지 않은지 설명하십시오.`;
        } else if (action === 'question') {
            task = `사용자의 질문에 현재 BioStrip 데이터만을 근거로 답하십시오.
질문: ${question}`;
        } else {
            task = '현재 BioStrip 분석 결과를 설명하십시오.';
        }

        const input = `${task}

현재 분석 결과:
${JSON.stringify(analysis, null, 2)}

Calibration 데이터:
${JSON.stringify(calibration, null, 2)}

최근 기록:
${JSON.stringify(history, null, 2)}`;

        const response = await fetch(
            'https://api.openai.com/v1/responses',
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    model: process.env.OPENAI_MODEL || 'gpt-6.2-astra',
                    instructions,
                    input
                })
            }
        );

        const data = await response.json();

        if (!response.ok) {
            console.error('OpenAI error:', data);
            return res.status(response.status).json({
                error:
                    data?.error?.message ||
                    'OpenAI API 요청에 실패했습니다.'
            });
        }

        const text =
            typeof data.output_text === 'string'
                ? data.output_text
                : Array.isArray(data.output)
                    ? data.output
                        .flatMap(item =>
                            Array.isArray(item.content)
                                ? item.content
                                : []
                        )
                        .filter(item =>
                            item.type === 'output_text' &&
                            typeof item.text === 'string'
                        )
                        .map(item => item.text)
                        .join('\n')
                    : '';

        return res.status(200).json({
            text: text || 'AI가 반환한 텍스트가 없습니다.'
        });
    } catch (error) {
        console.error('BioStrip AI server error:', error);

        return res.status(500).json({
            error: 'AI 서버에서 오류가 발생했습니다.'
        });
    }
}
