import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import KnowledgeOverlayLayer from '../../components/KnowledgeOverlayLayer';
import KnowledgePopoverCard from '../../components/KnowledgePopoverCard';
import { getDefaultPageAnnotations } from '../knowledgeTermMatcher';

declare const describe: (name: string, fn: () => void) => void;
declare const it: (name: string, fn: () => void) => void;
declare const expect: (actual: any) => any;

describe('Step 3: KnowledgeOverlayLayer & KnowledgePopoverCard UI', () => {
    const sampleAnnotations = getDefaultPageAnnotations('국어3-1', 1);

    it('AC-1: hides all term badges when enabled=false and renders interactive badges when enabled=true', () => {
        const hiddenHtml = renderToStaticMarkup(
            React.createElement(KnowledgeOverlayLayer, {
                enabled: false,
                pageNumber: 1,
                annotations: sampleAnnotations,
                onSelectAnnotation: () => {}
            })
        );
        expect(hiddenHtml).toBe('');

        const visibleHtml = renderToStaticMarkup(
            React.createElement(KnowledgeOverlayLayer, {
                enabled: true,
                pageNumber: 1,
                annotations: sampleAnnotations,
                onSelectAnnotation: () => {}
            })
        );
        expect(visibleHtml).toContain('knowledge-overlay-layer-p1');
        expect(visibleHtml).toContain(sampleAnnotations[0].term);
    });

    it('AC-2: renders 2-tier KnowledgePopoverCard with basic summary by default and expands deep dive when requested', () => {
        const target = sampleAnnotations[0];

        const collapsedHtml = renderToStaticMarkup(
            React.createElement(KnowledgePopoverCard, {
                annotation: target,
                anchorRect: { left: 200, top: 180, width: 100, height: 32 },
                viewportSize: { width: 1280, height: 800 },
                initialExpanded: false,
                onClose: () => {},
                onAddToReviewQueue: () => {}
            })
        );

        expect(collapsedHtml).toContain(target.term);
        expect(collapsedHtml).toContain(target.basicSummary);
        expect(collapsedHtml).toContain('더 알아보기');
        expect(collapsedHtml).toContain('다음에 보기 담기');
        expect(collapsedHtml).not.toContain('더 알아보기 (심화 해설)');

        const expandedHtml = renderToStaticMarkup(
            React.createElement(KnowledgePopoverCard, {
                annotation: target,
                anchorRect: { left: 200, top: 180, width: 100, height: 32 },
                viewportSize: { width: 1280, height: 800 },
                initialExpanded: true,
                isInReviewQueue: true,
                onClose: () => {},
                onAddToReviewQueue: () => {}
            })
        );

        expect(expandedHtml).toContain('더 알아보기 (심화 해설)');
        expect(expandedHtml).toContain(target.deepDive);
        expect(expandedHtml).toContain('간단히 보기');
        expect(expandedHtml).toContain('복습 큐에 담김');
    });
});
