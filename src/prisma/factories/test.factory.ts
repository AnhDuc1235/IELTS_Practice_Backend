import {
  Prisma,
  QuestionType,
  Skill,
  TestCategory,
  TestStatus,
} from "../../generated/prisma/client";

export const DEMO_AUTHOR_ID = "demo-test-author";

export const DEMO_TEST_TITLES = [
  "[Demo] IELTS Academic Listening Practice",
  "[Demo] IELTS Academic Reading Practice",
] as const;

export function createDemoTests(): Prisma.TestCreateInput[] {
  return [
    {
      skill: Skill.LISTENING,
      category: TestCategory.ACADEMIC,
      title: DEMO_TEST_TITLES[0],
      description: "A short, seeded listening test for local development.",
      level: "Intermediate",
      durationMinutes: 40,
      status: TestStatus.PUBLISHED,
      creator: { connect: { id: DEMO_AUTHOR_ID } },
      parts: {
        create: [
          {
            partNo: 1,
            title: "Booking a language course",
            instruction: "Listen to the conversation and answer the questions.",
            transcript:
              "Staff: Good morning. How can I help you? Student: I would like to book an evening course.",
            questionGroups: {
              create: [
                {
                  groupNo: 1,
                  questionType: QuestionType.MCQ_SINGLE,
                  instruction: "Choose the correct answer.",
                  questions: {
                    create: [
                      {
                        questionNo: 1,
                        content: "When does the student want to attend the course?",
                        explanation: "The student asks for an evening course.",
                        options: {
                          create: [
                            { label: "A", content: "In the morning" },
                            { label: "B", content: "In the afternoon" },
                            { label: "C", content: "In the evening" },
                          ],
                        },
                        answers: { create: [{ answerText: "C" }] },
                      },
                    ],
                  },
                },
              ],
            },
          },
          {
            partNo: 2,
            title: "Community library",
            instruction: "Complete the sentence using the information you hear.",
            transcript: "The new library will open next to the community park.",
            questionGroups: {
              create: [
                {
                  groupNo: 1,
                  questionType: QuestionType.FILL_BLANK,
                  instruction: "Write no more than two words.",
                  questions: {
                    create: [
                      {
                        questionNo: 2,
                        content: "The new library will open next to the ________.",
                        answers: { create: [{ answerText: "community park" }] },
                      },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
    {
      skill: Skill.READING,
      category: TestCategory.ACADEMIC,
      title: DEMO_TEST_TITLES[1],
      description: "A short, seeded reading test for local development.",
      level: "Intermediate",
      durationMinutes: 60,
      status: TestStatus.PUBLISHED,
      creator: { connect: { id: DEMO_AUTHOR_ID } },
      parts: {
        create: [
          {
            partNo: 1,
            title: "Urban gardens",
            instruction: "Read the passage and answer the questions.",
            content:
              "Urban gardens are small green spaces created within towns and cities. " +
              "They can provide fresh produce, support local wildlife, and give residents " +
              "a place to meet. Many projects use unused land and are maintained by volunteers.",
            questionGroups: {
              create: [
                {
                  groupNo: 1,
                  questionType: QuestionType.TRUE_FALSE_NG,
                  instruction: "Write TRUE, FALSE, or NOT GIVEN.",
                  questions: {
                    create: [
                      {
                        questionNo: 1,
                        content: "Some urban gardens are maintained by volunteers.",
                        explanation:
                          "The passage says that many projects are maintained by volunteers.",
                        answers: { create: [{ answerText: "TRUE" }] },
                      },
                    ],
                  },
                },
                {
                  groupNo: 2,
                  questionType: QuestionType.MCQ_SINGLE,
                  instruction: "Choose the correct answer.",
                  questions: {
                    create: [
                      {
                        questionNo: 2,
                        content: "Which benefit of urban gardens is mentioned?",
                        options: {
                          create: [
                            { label: "A", content: "They reduce public transport costs." },
                            { label: "B", content: "They support local wildlife." },
                            { label: "C", content: "They replace city schools." },
                          ],
                        },
                        answers: { create: [{ answerText: "B" }] },
                      },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
  ];
}
