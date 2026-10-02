import React, { useState } from "react";
import { Plus, MoreVertical, Edit2, Copy, Trash2, LayoutDashboard } from "lucide-react";

export default function ReportPageManager({
  pages = [],
  activePageId,
  onSelectPage,
  onAddPage,
  onRenamePage,
  onDuplicatePage,
  onDeletePage
}) {
  const [editingPageId, setEditingPageId] = useState(null);
  const [editTitle, setEditTitle] = useState("");
  const [menuOpenId, setMenuOpenId] = useState(null);

  function startRename(page) {
    setEditingPageId(page.id);
    setEditTitle(page.title);
    setMenuOpenId(null);
  }

  function commitRename(pageId) {
    if (editTitle.trim()) {
      onRenamePage(pageId, editTitle.trim());
    }
    setEditingPageId(null);
  }

  return (
    <div className="bi-pages-bar">
      <div className="bi-pages-tabs">
        {pages.map((page, index) => {
          const isActive = page.id === activePageId;
          const isEditing = editingPageId === page.id;

          return (
            <div
              key={page.id}
              className={`bi-page-tab ${isActive ? "active" : ""}`}
              onClick={() => onSelectPage(page.id)}
            >
              <LayoutDashboard size={13} className="bi-tab-icon" />

              {isEditing ? (
                <input
                  type="text"
                  className="bi-tab-rename-input"
                  value={editTitle}
                  autoFocus
                  onChange={e => setEditTitle(e.target.value)}
                  onBlur={() => commitRename(page.id)}
                  onKeyDown={e => {
                    if (e.key === "Enter") commitRename(page.id);
                    if (e.key === "Escape") setEditingPageId(null);
                  }}
                  onClick={e => e.stopPropagation()}
                />
              ) : (
                <span
                  className="bi-tab-label"
                  onDoubleClick={e => {
                    e.stopPropagation();
                    startRename(page);
                  }}
                >
                  {page.title}
                </span>
              )}

              {/* Page Menu Trigger */}
              <button
                type="button"
                className="bi-tab-menu-trigger"
                onClick={e => {
                  e.stopPropagation();
                  setMenuOpenId(menuOpenId === page.id ? null : page.id);
                }}
              >
                <MoreVertical size={12} />
              </button>

              {/* Context Dropdown Menu */}
              {menuOpenId === page.id && (
                <div className="bi-tab-context-menu" onClick={e => e.stopPropagation()}>
                  <button
                    type="button"
                    className="bi-context-item"
                    onClick={() => startRename(page)}
                  >
                    <Edit2 size={12} /> Rename Page
                  </button>
                  <button
                    type="button"
                    className="bi-context-item"
                    onClick={() => {
                      onDuplicatePage(page.id);
                      setMenuOpenId(null);
                    }}
                  >
                    <Copy size={12} /> Duplicate Page
                  </button>
                  {pages.length > 1 && (
                    <button
                      type="button"
                      className="bi-context-item danger"
                      onClick={() => {
                        onDeletePage(page.id);
                        setMenuOpenId(null);
                      }}
                    >
                      <Trash2 size={12} /> Delete Page
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {/* Add Page Button */}
        <button
          type="button"
          className="bi-add-page-btn"
          title="Add New Dashboard Page"
          onClick={onAddPage}
        >
          <Plus size={14} />
          <span>New Page</span>
        </button>
      </div>
    </div>
  );
}
