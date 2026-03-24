import { notFound } from "next/navigation";
import { JapaneseInputLab } from "@/components/japanese-input-lab";
import { LessonSession } from "@/components/lesson-session";
import { PixelCard } from "@/components/pixel-card";
import { PixelHeading } from "@/components/pixel-heading";
import { RubyText } from "@/components/ruby-text";
import { getAllScenes, getLesson } from "@/lib/content";
import type { SceneId } from "@/lib/types/content";

const sceneNameMap: Record<SceneId, string> = {
  airport: "机场",
  hotel: "酒店",
  izakaya: "居酒屋",
  shopping: "购物"
};

interface LessonPageProps {
  params: {
    sceneId: string;
    lessonId: string;
  };
}

export function generateStaticParams() {
  return getAllScenes().flatMap((scene) =>
    scene.lessons.map((lesson) => ({
      sceneId: scene.id,
      lessonId: lesson.id
    }))
  );
}

export default function LessonPage({ params }: LessonPageProps) {
  const sceneId = params.sceneId as SceneId;
  const lesson = getLesson(sceneId, params.lessonId);
  const lessonTitleMap = Object.fromEntries(
    getAllScenes().flatMap((scene) => scene.lessons.map((entry) => [entry.id, entry.title]))
  );

  if (!lesson) {
    notFound();
  }

  return (
    <div className="page-stack">
      <PixelHeading
        kicker={`${sceneNameMap[sceneId]} / ${lesson.code}`}
        title={lesson.title}
      />

      <PixelCard soft>
        <div className="meta-row">
          <span className="badge">{lesson.cards.length} 句型卡</span>
          <span className="badge">{lesson.wordBank.length} 关键词</span>
        </div>
      </PixelCard>

      <LessonSession sceneId={sceneId} lesson={lesson} lessonTitleMap={lessonTitleMap} />

      <section className="page-stack">
        {lesson.cards.map((card) => (
          <PixelCard key={card.id}>
            <article className="phrase-card">
              <div className="meta-row">
                <span className="badge">{card.id}</span>
                <span className="badge">{card.isCore ? "核心" : "日常"}</span>
                {card.tags.map((tag) => (
                  <span key={tag} className="badge">
                    {tag}
                  </span>
                ))}
              </div>
              <div className="turn-list">
                {card.turns.map((turn) => (
                  <div key={turn.id} className="turn">
                    <div className="turn-role">
                      {turn.role === "learner" ? "你说" : "对方说"}
                    </div>
                    <div className="turn-ja">
                      <RubyText tokens={turn.ruby} />
                    </div>
                    <div className="turn-kana">{turn.kana}</div>
                    <div className="turn-zh">{turn.zh}</div>
                  </div>
                ))}
              </div>
            </article>
          </PixelCard>
        ))}
      </section>

      <PixelCard>
        <h2 className="section-title">输入法测试台</h2>
        <JapaneseInputLab />
      </PixelCard>
    </div>
  );
}
