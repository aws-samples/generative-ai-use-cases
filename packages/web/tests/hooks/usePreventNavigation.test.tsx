import { describe, it, expect } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider, Link } from 'react-router-dom';
import usePreventNavigation from '../../src/hooks/usePreventNavigation';

const GO = 'go';
const OTHER = 'other page';

// Uses the hook with the same options as ChatPage: only reload, closing the
// tab and leaving the site are guarded, because the chat draft survives
// in-app navigation.
const DraftPage = ({ draft }: { draft: string }) => {
  usePreventNavigation(draft.trim() !== '', {
    blockInternalNavigation: false,
  });
  return <Link to="/other">{GO}</Link>;
};

const setup = (draft: string) => {
  const router = createMemoryRouter(
    [
      { path: '/chat', element: <DraftPage draft={draft} /> },
      { path: '/other', element: <span>{OTHER}</span> },
    ],
    { initialEntries: ['/chat'] }
  );
  render(<RouterProvider router={router} />);
  return router;
};

const fireBeforeUnload = () => {
  const event = new Event('beforeunload', { cancelable: true });
  window.dispatchEvent(event);
  return event;
};

describe('usePreventNavigation for the chat draft', () => {
  it('asks before unload while the draft has text', () => {
    setup('half-written question');
    expect(fireBeforeUnload().defaultPrevented).toBe(true);
  });

  it('does not ask before unload when the draft is blank', () => {
    setup('   ');
    expect(fireBeforeUnload().defaultPrevented).toBe(false);
  });

  it('does not block in-app navigation, which keeps the draft', async () => {
    const router = setup('half-written question');
    await act(async () => {
      screen.getByText(GO).click();
    });
    expect(router.state.location.pathname).toBe('/other');
  });
});
