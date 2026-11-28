/* eslint-disable @shopify/jsx-no-hardcoded-content */
import { describe, it, expect, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import {
  createMemoryRouter,
  RouterProvider,
  Link,
  useNavigate,
} from 'react-router-dom';
import useLeaveGuard from '../../src/hooks/useLeaveGuard';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
// The dialog measures itself with a ResizeObserver, which jsdom lacks
vi.stubGlobal(
  'ResizeObserver',
  vi.fn(function () {
    return { observe: vi.fn(), unobserve: vi.fn(), disconnect: vi.fn() };
  })
);

// An edit page that can leave for a skill, another page, or after a save
const EditPage = ({ unsaved }: { unsaved: boolean }) => {
  const navigate = useNavigate();
  const guard = useLeaveGuard(unsaved, (path) =>
    path.startsWith('/agent-builder/skills')
  );
  return (
    <>
      {guard.dialog}
      <Link to="/agent-builder/skills/s1/edit">skill</Link>
      <Link to="/other">other</Link>
      <button
        onClick={() => {
          guard.leave();
          navigate('/saved');
        }}>
        save
      </button>
    </>
  );
};

const setup = (unsaved: boolean) => {
  const router = createMemoryRouter(
    [
      {
        path: '/agent-builder/a1/edit',
        element: <EditPage unsaved={unsaved} />,
      },
      { path: '*', element: <span>elsewhere</span> },
    ],
    { initialEntries: ['/agent-builder/a1/edit'] }
  );
  render(<RouterProvider router={router} />);
  return router;
};

const click = async (text: string) => {
  await act(async () => {
    screen.getByText(text).click();
  });
};

describe('useLeaveGuard', () => {
  it('asks before leaving with unsaved changes, and leaves when confirmed', async () => {
    const router = setup(true);
    await click('other');
    expect(router.state.location.pathname).toBe('/agent-builder/a1/edit');
    expect(screen.getByText('dialog.unsavedChanges.message')).toBeDefined();

    await click('dialog.unsavedChanges.leave');
    expect(router.state.location.pathname).toBe('/other');
  });

  it('stays when the user cancels', async () => {
    const router = setup(true);
    await click('other');
    await click('common.cancel');
    expect(router.state.location.pathname).toBe('/agent-builder/a1/edit');
  });

  it('lets an allowed destination through', async () => {
    const router = setup(true);
    await click('skill');
    expect(router.state.location.pathname).toBe(
      '/agent-builder/skills/s1/edit'
    );
  });

  it('lets the navigation after a save through', async () => {
    const router = setup(true);
    await click('save');
    expect(router.state.location.pathname).toBe('/saved');
  });

  it('does not ask without unsaved changes', async () => {
    const router = setup(false);
    await click('other');
    expect(router.state.location.pathname).toBe('/other');
  });
});
