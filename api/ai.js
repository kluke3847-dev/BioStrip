export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "POST 요청만 허용됩니다."
    });
  }

  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return res.status(500).json({
      error: "OPENAI_API_KEY가 Vercel에 설정되어 있지 않습니다."
    });
  }

  try {
    const body = req.body || {};

    const analysis = body.analysis || {};
    const calibration = body.calibration || [];
    const history = body.history || [];
    const question =
      typeof body.question === "string"
        ? body.question.trim()
        : "현재 BioStrip 분석 결과를 해석해 주세요.";

    const prompt = `
당신은 BioStrip의 실험 분석 보조 AI입니다.

중요한 규칙:
1. pH 값을 새로 계산하거나 임의로 수정하지 마세요.
2. BioStrip이 계산한 pH를 그대로 사용하세요.
3. 제공된 분석 데이터만 근거로 설명하세요.
4. 데이터가 부족하면 부족하다고 명확하게 말하세요.
5. 촬영 품질, calibration 상태, 색상 변화, 반복 측정 필요성을 설명할 수 있습니다.
6. 의료적 진단을 하지 마세요.
7. 사용자가 이해하기 쉬운 한국어로 답하세요.
8. 결과를 과장하지 마세요.
9. 현재 분석값과 실험 데이터의 한계를 분명히 설명하세요.

현재 분석 결과:
${JSON.stringify(analysis, null, 2)}

Calibration 데이터:
${JSON.stringify(calibration, null, 2)}

최근 분석 기록:
${JSON.stringify(history, null, 2)}

사용자 질문:
${question}
`;

    const response = await fetch(
      "https://api.openai.com/v1/responses",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: "gpt-6-luna",
          instructions:
            "당신은 BioStrip의 한국어 실험 분석 보조 AI입니다.",
          input: prompt
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("OpenAI API error:", data);

      return res.status(response.status).json({
        error:
          data?.error?.message ||
          "OpenAI API 요청에 실패했습니다."
      });
    }

    let text = "";

    if (typeof data.output_text === "string") {
      text = data.output_text;
    } else if (Array.isArray(data.output)) {
      text = data.output
        .flatMap((item) => {
          if (!Array.isArray(item.content)) {
            return [];
          }

          return item.content
            .filter((part) => part.type === "output_text")
            .map((part) => part.text || "");
        })
        .join("\n");
    }

    if (!text.trim()) {
      text = "AI가 분석 결과를 반환하지 않았습니다.";
    }

    return res.status(200).json({
      text
    });
  } catch (error) {
    console.error("Server error:", error);

    return res.status(500).json({
      error: "AI 서버에서 오류가 발생했습니다."
    });
  }
}
