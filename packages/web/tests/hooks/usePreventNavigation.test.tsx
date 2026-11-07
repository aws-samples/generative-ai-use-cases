import { describe, it, expect } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider, Link } from 'react-router-dom';
import usePreventNavigation from '../../src/hooks/usePreventNavigation';

const GO = 'go';
const OTHER = 'other page';

// A page shaped like ChatPage: it blocks while the draft is not blank.
const DraftPage = ({ draft }: { draft: string }) => {
  const blocker = usePreventNavigation(draft.trim() !== '');
  return (
    <>
      <Link to="/other">{GO}</Link>
      <span data-testid="state">{blocker.state}</span>
    </>
  );
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

describe('usePreventNavigation with a chat draft', () => {
  it('blocks leaving while the draft has text', async () => {
    const router = setup('half-written question');
    await act(async () => {
      screen.getByText(GO).click();
    });
    expect(screen.getByTestId('state').textContent).toBe('blocked');
    expect(router.state.location.pathname).toBe('/chat');
  });

  it('lets the user leave when the draft is blank', async () => {
    const router = setup('   ');
    await act(async () => {
      screen.getByText(GO).click();
    });
    expect(router.state.location.pathname).toBe('/other');
  });
});
