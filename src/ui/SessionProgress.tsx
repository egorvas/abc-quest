import './SessionProgress.css'

export type StepMark = 'pending' | 'current' | 'good' | 'retry'

interface SessionProgressProps {
  readonly marks: readonly StepMark[]
}

/** A row of dots so the child can see how much is left. No numbers, no timer. */
export function SessionProgress({ marks }: SessionProgressProps) {
  return (
    <div className="sprog" role="progressbar" aria-valuemax={marks.length}>
      {marks.map((mark, index) => (
        <span key={index} className={`sprog__dot sprog__dot--${mark}`} />
      ))}
    </div>
  )
}
