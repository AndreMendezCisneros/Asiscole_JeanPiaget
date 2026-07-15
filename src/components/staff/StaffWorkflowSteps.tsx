import { cn } from '@/lib/utils';
import { Check } from 'lucide-react';

export interface StaffWorkflowStep {
  id: string;
  label: string;
  description?: string;
}

interface StaffWorkflowStepsProps {
  steps: StaffWorkflowStep[];
  currentStep: string;
  className?: string;
}

export function StaffWorkflowSteps({ steps, currentStep, className }: StaffWorkflowStepsProps) {
  const currentIndex = steps.findIndex((s) => s.id === currentStep);

  return (
    <ol className={cn('app-workflow-steps', className)} aria-label="Progreso">
      {steps.map((step, index) => {
        const done = index < currentIndex;
        const active = step.id === currentStep;
        return (
          <li
            key={step.id}
            className={cn(
              'app-workflow-step',
              done && 'app-workflow-step--done',
              active && 'app-workflow-step--active'
            )}
          >
            <span className="app-workflow-step__marker" aria-hidden>
              {done ? <Check className="h-3.5 w-3.5" /> : index + 1}
            </span>
            <span className="min-w-0">
              <span className="block text-xs font-semibold sm:text-sm">{step.label}</span>
              {step.description && active && (
                <span className="mt-0.5 block text-[11px] text-muted-foreground">
                  {step.description}
                </span>
              )}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
