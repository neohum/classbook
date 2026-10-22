import {
    DEFAULT_MARKET_CATALOG,
    validateLessonMaterialRef,
    validateSelfCheckItem,
    recommendMarketMaterials,
    bindMaterialToPeriod,
    unbindMaterialFromPeriod,
    getPeriodMaterials,
    getAllPeriodBindings,
    getSelfCheckList,
    toggleSelfCheckItem,
    addSelfCheckTask
} from '../marketRecommender';
import type { LessonMaterialRef } from '../../types/weeklyPlanMarket';

declare const describe: (name: string, fn: () => void) => void;
declare const it: (name: string, fn: () => void) => void;
declare const expect: (actual: any) => any;

describe('Step 1: Market Recommender, Period Binding & PII-Free Self Check', () => {
    it('AC-1: recommends ranked All-Market materials matching subject and topic keywords', () => {
        const mathRecs = recommendMarketMaterials('수학', '분수와 소수 크기 비교하기');
        expect(mathRecs.length).toBeGreaterThan(0);
        expect(mathRecs[0].subject).toBe('수학');
        expect(mathRecs[0].id).toBe('mkt-math-fraction-01');

        const korRecs = recommendMarketMaterials('국어', '글자의 짜임과 받아쓰기 연습');
        expect(korRecs.length).toBeGreaterThan(0);
        expect(korRecs[0].subject).toBe('국어');
        expect(korRecs[0].id).toBe('mkt-kor-dictation-01');

        const sciRecs = recommendMarketMaterials('과학', '자석의 성질 실험 및 관찰 기록');
        expect(sciRecs.length).toBeGreaterThan(0);
        expect(sciRecs[0].subject).toBe('과학');
        expect(sciRecs[0].id).toBe('mkt-sci-lab-01');
    });

    it('AC-2: validates LessonMaterialRef and rejects unsafe URLs or invalid types', () => {
        const validSample = DEFAULT_MARKET_CATALOG[0];
        expect(validateLessonMaterialRef(validSample).valid).toBe(true);

        const invalidScheme = {
            ...validSample,
            urlOrPath: 'javascript:alert(1)'
        };
        expect(validateLessonMaterialRef(invalidScheme).valid).toBe(false);

        const invalidType = {
            ...validSample,
            type: 'unknown_type' as any
        };
        expect(validateLessonMaterialRef(invalidType).valid).toBe(false);
    });

    it('AC-3: binds, retrieves, and unbinds materials per day/period with localStorage persistence', () => {
        const sampleMat: LessonMaterialRef = DEFAULT_MARKET_CATALOG[2]; // 분수 교구
        const bound = bindMaterialToPeriod('월', 2, '수학', '분수의 크기 비교', sampleMat);

        expect(bound.day).toBe('월');
        expect(bound.period).toBe(2);
        expect(bound.materials).toHaveLength(1);
        expect(bound.materials[0].id).toBe(sampleMat.id);

        const loaded = getPeriodMaterials('월', 2);
        expect(loaded).toHaveLength(1);
        expect(loaded[0].title).toBe(sampleMat.title);

        const allBindings = getAllPeriodBindings();
        expect(Boolean(allBindings['월_2'])).toBe(true);

        unbindMaterialFromPeriod('월', 2, sampleMat.id);
        expect(getPeriodMaterials('월', 2)).toHaveLength(0);
    });

    it('AC-4: enforces PII-free SelfCheckItem validation and supports toggling and adding tasks', () => {
        const initialList = getSelfCheckList();
        expect(initialList.length).toBeGreaterThanOrEqual(4);
        expect(initialList[0].completed).toBe(false);

        // Toggle completion
        const toggled = toggleSelfCheckItem(initialList[0].id);
        expect(toggled[0].completed).toBe(true);
        expect(Boolean(toggled[0].completedAt)).toBe(true);

        // Add anonymous daily task
        const withAdded = addSelfCheckTask('모둠 실험 준비물 챙기기', 'task');
        expect(withAdded.length).toBe(initialList.length + 1);
        expect(withAdded[withAdded.length - 1].label).toBe('모둠 실험 준비물 챙기기');

        // Reject PII field (studentName / residentNumber)
        const piiObject = {
            id: 'bad-1',
            label: '출석 확인',
            category: 'attendance',
            completed: false,
            sessionToken: 'anon_123',
            studentName: '홍길동'
        };
        expect(validateSelfCheckItem(piiObject).valid).toBe(false);

        // Reject resident registration number pattern in label
        let rrnErrorThrown = false;
        try {
            addSelfCheckTask('학생 주민번호 120304-3123456 확인');
        } catch (err) {
            rrnErrorThrown = true;
        }
        expect(rrnErrorThrown).toBe(true);
    });
});
