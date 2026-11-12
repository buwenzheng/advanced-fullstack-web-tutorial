import { project as shipProject } from './project-ship.js';
import { project as productionProject } from './project-production.js';

export const project = {
  ...shipProject,
  title: 'LinkHub 生产交付',
  brief: `${shipProject.brief} ${productionProject.brief}`,
  goal: `${shipProject.goal} ${productionProject.goal}`,
  stack: [...shipProject.stack, ...productionProject.stack],
  steps: [...shipProject.steps, ...productionProject.steps],
  milestones: [...shipProject.milestones, ...productionProject.milestones],
  deliverables: [...shipProject.deliverables, ...productionProject.deliverables],
  checklist: [...shipProject.checklist, ...productionProject.checklist],
  stretch: [...shipProject.stretch, ...productionProject.stretch],
};
