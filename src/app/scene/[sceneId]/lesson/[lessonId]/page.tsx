import { notFound } from "next/navigation";
import { JapaneseInputLab } from "@/components/japanese-input-lab";
import { LessonSession } from "@/components/lesson-session";
import { PixelCard } from "@/components/pixel-card";
import { PixelHeading } from "@/components/pixel-heading";
import { RubyText } from "@/components/ruby-text";
import { getAllScenes, getLesson } from "@/lib/content";
import type { SceneId } from "@/lib/types/content";

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

  if (!lesson) {
    notFound();
  }

  return (
    <div className="page-stack">
      <PixelHeading
        kicker={`${sceneId.toUpperCase()} / ${lesson.code}`}
        title={lesson.title}
        description={lesson.overview}
      />

      <PixelCard soft>
        <div className="meta-row">
          <span className="badge">{lesson.cards.length} dialogue cards</span>
          <span className="badge">{lesson.wordBank.length} keywords</span>
        </div>
      </PixelCard>

      <LessonSession sceneId={sceneId} lesson={lesson} />

      <section className="page-stack">
        {lesson.cards.map((card) => (
          <PixelCard key={card.id}>
            <article className="phrase-card">
              <div className="meta-row">
                <span className="badge">{card.id}</span>
                <span className="badge">{card.isCore ? "CORE" : "ROUTINE"}</span>
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
                      {turn.role === "learner" ? "YOU SAY" : "PARTNER SAYS"}
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
        <h2 className="section-title">IME Input Sandbox</h2>
        <JapaneseInputLab />
      </PixelCard>
    </div>
  );
}
