// Droits par rôle, tels que décrits dans le sujet de la SAÉ.
// Le même tableau devra être appliqué côté Symfony (voters) : le front ne fait qu'adapter l'interface.

const can = {
  rate: (u) => !!u && u.role !== 'visitor' && !u.banned,
  comment: (u) => !!u && u.role !== 'visitor' && !u.banned,
  report: (u) => !!u && u.role !== 'visitor',
  createArticle: (u) => !!u && ['author', 'editor', 'admin'].includes(u.role) && !u.banned,
  editArticle: (u, article) =>
    !!u &&
    !u.banned &&
    (['editor', 'admin'].includes(u.role) || (u.role === 'author' && article?.authorId === u.id)),
  deleteArticle: (u, article) =>
    !!u && (['editor', 'admin'].includes(u.role) || (u.role === 'author' && article?.authorId === u.id)),
  moderate: (u) => !!u && u.role === 'admin',
  banAuthor: (u) => !!u && u.role === 'admin',
  deleteComment: (u, comment) => !!u && (u.role === 'admin' || comment?.userId === u.id),
  editTheme: (u) => !!u && ['designer', 'admin'].includes(u.role),
  manageDatasets: (u) => !!u && ['provider', 'admin'].includes(u.role),
  seeDrafts: (u) => !!u && ['author', 'editor', 'admin'].includes(u.role),
};

export default can;
