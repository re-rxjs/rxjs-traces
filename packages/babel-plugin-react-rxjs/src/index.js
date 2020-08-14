module.exports = function ({ types: t }) {
  return {
    name: 'react-rxjs',
    visitor: {

      FunctionDeclaration: {
        enter(path) {
          path
            .get('body')
            .unshiftContainer(
              'body',
              t.callExpression(
                t.memberExpression(t.identifier('console'), t.identifier('time')),
                [t.stringLiteral(path.node.id.name)]
              )
            );
        },
        exit(path) {
          // check last expression from BlockStatement
          const blockStatement = path.get('body')
          const lastExpression = blockStatement.get('body').pop();
          const timeEndStatement = t.callExpression(
            t.memberExpression(t.identifier('console'), t.identifier('timeEnd')),
            [t.stringLiteral(path.node.id.name)]
          );

          if (lastExpression.type !== 'ReturnStatement') {
            lastExpression.insertAfter(timeEndStatement);
          } else {
            lastExpression.insertBefore(timeEndStatement);
          }
        }
      }
    }
  }
}