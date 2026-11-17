"""Monta a URI localmente sem mostrar a senha no terminal ou enviar dados à rede."""
import os
from getpass import getpass
from urllib.parse import quote


def main():
    senha = getpass('Cole a última senha salva no Atlas para clube_planner_app: ')
    confirmar = getpass('Cole a mesma senha novamente: ')
    if not senha or senha != confirmar:
        print('As senhas estão vazias ou diferentes. Nenhum arquivo foi criado.')
        return 1
    arquivo = '.env.atlas'
    uri = ('mongodb+srv://clube_planner_app:' + quote(senha, safe='')
           + '@mongo10.mv3l968.mongodb.net/clube_planner'
           + '?retryWrites=true&w=majority&authSource=admin')
    try:
        fd = os.open(arquivo, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    except FileExistsError:
        print('O arquivo .env.atlas já existe e foi preservado.')
        return 1
    with os.fdopen(fd, 'w') as destino:
        destino.write('MONGODB_URI=' + uri + '\n')
    print('Conexão montada no arquivo privado .env.atlas. Não envie seu conteúdo no chat.')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
