// SPDX-License-Identifier: AGPL-3.0-only
import { renderHook, waitFor, act } from '@testing-library/react';
import MetadataService from '../../services/MetadataService';
import RelationshipService from '../../services/RelationshipService';
import QueryManagementService from '../../services/QueryManagementService';
import useOnboarding from '../useOnboarding';

// jest.mock calls are hoisted above the imports above by babel-jest.
jest.mock('../../services/MetadataService', () => ({
  __esModule: true,
  default: { getDescriptions: jest.fn() },
}));
jest.mock('../../services/RelationshipService', () => ({
  __esModule: true,
  default: { getRelationships: jest.fn() },
}));
jest.mock('../../services/QueryManagementService', () => ({
  __esModule: true,
  default: { getQueryHistory: jest.fn() },
}));

const settle = (result) =>
  waitFor(() => expect(result.current.loading).toBe(false));

describe('useOnboarding', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    try { localStorage.clear(); } catch { /* noop */ }
    // Default: nothing set up yet.
    MetadataService.getDescriptions.mockResolvedValue({ descriptions: [] });
    RelationshipService.getRelationships.mockResolvedValue({ relationships: [] });
    QueryManagementService.getQueryHistory.mockResolvedValue({ queries: [] });
  });

  test('all three milestones present → allDone', async () => {
    MetadataService.getDescriptions.mockResolvedValue({ descriptions: [{ id: 1 }] });
    RelationshipService.getRelationships.mockResolvedValue({ relationships: [{ id: 1 }] });
    QueryManagementService.getQueryHistory.mockResolvedValue({ queries: [{ id: 1 }] });

    const { result } = renderHook(() => useOnboarding());
    await settle(result);

    expect(result.current.completeCount).toBe(3);
    expect(result.current.allDone).toBe(true);
    expect(result.current.steps.every((s) => s.done)).toBe(true);
  });

  test('partial completion → only the matching step is done', async () => {
    MetadataService.getDescriptions.mockResolvedValue({ descriptions: [{ id: 1 }] });
    // relationships + query history stay empty (from beforeEach)

    const { result } = renderHook(() => useOnboarding());
    await settle(result);

    expect(result.current.completeCount).toBe(1);
    expect(result.current.allDone).toBe(false);
    expect(result.current.steps.find((s) => s.id === 'schema').done).toBe(true);
    expect(result.current.steps.find((s) => s.id === 'relationships').done).toBe(false);
  });

  test('a rejected detection call leaves that step incomplete without throwing', async () => {
    MetadataService.getDescriptions.mockRejectedValue(new Error('network'));
    RelationshipService.getRelationships.mockResolvedValue({ relationships: [{ id: 1 }] });
    QueryManagementService.getQueryHistory.mockResolvedValue({ queries: [{ id: 1 }] });

    const { result } = renderHook(() => useOnboarding());
    await settle(result);

    expect(result.current.steps.find((s) => s.id === 'schema').done).toBe(false);
    expect(result.current.completeCount).toBe(2);
  });

  test('toggleCollapsed flips state and persists to localStorage', async () => {
    const { result } = renderHook(() => useOnboarding());
    await settle(result);

    expect(result.current.collapsed).toBe(false);

    act(() => { result.current.toggleCollapsed(); });
    expect(result.current.collapsed).toBe(true);
    expect(localStorage.getItem('actyze_onboarding_collapsed')).toBe('1');

    act(() => { result.current.toggleCollapsed(); });
    expect(result.current.collapsed).toBe(false);
    expect(localStorage.getItem('actyze_onboarding_collapsed')).toBe(null);
  });
});
