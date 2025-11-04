from api.models import ISP

data=[('ISP-A','8.8.8.8'),('ISP-B','1.1.1.1'),('ISP-C','9.9.9.9'),('ISP-D','208.67.222.222'),('ISP-E','8.26.56.26')]
objs=[]
for n,h in data:
    objs.append(ISP.objects.create(name=n, host=h))
print('Created', len(objs))
